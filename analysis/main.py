"""
Entry point for the analysis microservice.

Responsibilities:
- Configure logging.
- Connect to MongoDB and Redis on startup.
- Backfill historical data for all watchlist items.
- Run a periodic scheduler that fetches new data, computes indicators,
  generates signals, and publishes them.
- Serve a Flask HTTP API for on-demand backtesting.
- Shut down gracefully on SIGINT / SIGTERM.
"""

from __future__ import annotations

import logging
import os
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify, request

from analyzer import analyze_symbol
from backtester import run_backtest_batch
from config import (
    DEFAULT_TIMEFRAMES,
    LOG_LEVEL,
)
from db import (
    get_db,
    get_symbols_with_prices,
    get_watchlist,
    save_signal,
    sync_strategies,
)
from fetcher import fetch_all_watchlist
from publisher import (
    get_redis,
    publish_price_update,
    publish_signal,
    subscribe_watchlist_added,
)
from strategies import STRATEGY_META, get_all_strategy_names

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Logging setup
# --------------------------------------------------------------------------- #


def _configure_logging() -> None:
    """Set up root logger with a human-readable format."""
    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    # Silence noisy third-party loggers
    logging.getLogger("yfinance").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)


# --------------------------------------------------------------------------- #
# Core job
# --------------------------------------------------------------------------- #


def fetch_and_analyze() -> None:
    """Scheduled job: fetch latest data, compute indicators, generate & publish signals."""
    logger.info("=== Starting fetch & analyze cycle ===")
    start = time.monotonic()

    try:
        watchlist = get_watchlist()
        if not watchlist:
            logger.warning("Watchlist is empty – nothing to do")
            return

        # 1. Fetch latest candles for every symbol/timeframe
        fetch_results = fetch_all_watchlist()
        logger.info("Fetch results: %s", fetch_results)

        # 2. Analyse each symbol
        for item in watchlist:
            symbol: str = item.get("symbol", "")
            if not symbol:
                continue

            item_timeframes = item.get("timeframes", DEFAULT_TIMEFRAMES)
            item_strategies = item.get("strategies", get_all_strategy_names())
            item_cooldown = item.get("signalCooldown")  # per-symbol override or None

            try:
                aggregated = analyze_symbol(
                    symbol, item_timeframes, item_strategies, item_cooldown
                )

                if aggregated is not None:
                    # Persist to MongoDB
                    save_signal(aggregated)

                    # Publish to Redis
                    publish_signal(aggregated)

                # Publish latest price regardless of signal
                _publish_latest_price(symbol, item_timeframes)

            except Exception:
                logger.exception("Analysis failed for %s", symbol)

    except Exception:
        logger.exception("Unhandled error in fetch_and_analyze")

    elapsed = time.monotonic() - start
    logger.info("=== Fetch & analyze cycle completed in %.1fs ===", elapsed)


def _publish_latest_price(symbol: str, timeframes: list[str]) -> None:
    """Publish the most recent price data for *symbol* to Redis."""
    from db import get_candles

    # Use the smallest timeframe available for the freshest price
    for tf in sorted(timeframes, key=lambda t: _tf_sort_key(t)):
        df = get_candles(symbol, tf, limit=1)
        if not df.empty:
            last = df.iloc[-1]
            price_data: dict[str, Any] = {
                "open": float(last["open"]),
                "high": float(last["high"]),
                "low": float(last["low"]),
                "close": float(last["close"]),
                "volume": int(last["volume"]),
                "timeframe": tf,
            }
            publish_price_update(symbol, price_data)
            return


def _tf_sort_key(tf: str) -> int:
    """Return a numeric sort key so smaller timeframes sort first."""
    order = {"1m": 1, "5m": 2, "15m": 3, "30m": 4, "1h": 5, "1d": 6, "1wk": 7}
    return order.get(tf, 99)


# --------------------------------------------------------------------------- #
# On-demand collection for newly added tickers
# --------------------------------------------------------------------------- #


def _handle_watchlist_added(item: dict[str, Any]) -> None:
    """Handle a ``watchlist:added`` Redis event.

    Immediately fetches Yahoo Finance data and runs analysis for the new
    symbol so the user doesn't have to wait for the next scheduled cycle.
    """
    symbol: str = item.get("symbol", "")
    if not symbol:
        logger.warning("watchlist:added event with no symbol – ignoring")
        return

    logger.info("New ticker added: %s – starting immediate data collection", symbol)
    item_timeframes = item.get("timeframes", DEFAULT_TIMEFRAMES)
    item_strategies = item.get("strategies", get_all_strategy_names())
    item_cooldown = item.get("signalCooldown")

    # 1. Fetch & persist historical candles (same as backfill, but for one symbol)
    from fetcher import fetch_candles
    from db import save_candles

    for tf in item_timeframes:
        try:
            df = fetch_candles(symbol, tf)
            if df is not None and not df.empty:
                count = save_candles(symbol, tf, df)
                logger.info(
                    "Immediate fetch: saved %d candles for %s/%s", count, symbol, tf
                )
        except Exception:
            logger.exception("Immediate fetch failed for %s/%s", symbol, tf)

    # 2. Run analysis and publish signals
    try:
        aggregated = analyze_symbol(
            symbol, item_timeframes, item_strategies, item_cooldown
        )

        if aggregated is not None:
            save_signal(aggregated)
            publish_signal(aggregated)

        _publish_latest_price(symbol, item_timeframes)
    except Exception:
        logger.exception("Immediate analysis failed for %s", symbol)

    logger.info("Immediate data collection complete for %s", symbol)


# --------------------------------------------------------------------------- #
# Flask HTTP API (for on-demand backtesting)
# --------------------------------------------------------------------------- #

flask_app = Flask(__name__)

# Suppress Flask/Werkzeug request logs unless in DEBUG mode
logging.getLogger("werkzeug").setLevel(logging.WARNING)

FLASK_PORT = int(os.getenv("ANALYSIS_HTTP_PORT", "5001"))


@flask_app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@flask_app.route("/backtest", methods=["POST"])
def start_backtest():
    """Run backtests for the given symbols x strategies.

    Request body (JSON):
        {
          "symbols": ["AAPL", "MSFT"],
          "strategies": ["ma_crossover", "rsi_reversal"],
          "executionId": "optional-mongodb-objectid-string"
        }

    Returns the batch result with all individual backtest results.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON"}), 400

    symbols = body.get("symbols", [])
    strategies = body.get("strategies", [])
    execution_id = body.get("executionId")
    strategy_params = body.get("strategyParams")  # optional dict

    if not symbols:
        return jsonify({"error": "At least one symbol is required"}), 400
    if not strategies:
        return jsonify({"error": "At least one strategy is required"}), 400

    # Validate strategy names
    known = set(STRATEGY_META.keys())
    unknown = [s for s in strategies if s not in known]
    if unknown:
        return jsonify({"error": f"Unknown strategies: {unknown}"}), 400

    try:
        result = run_backtest_batch(
            symbols,
            strategies,
            execution_id=execution_id,
            strategy_params=strategy_params,
        )
        # Serialise datetime objects for JSON
        return jsonify(_serialise_batch(result))
    except Exception as exc:
        logger.exception("Backtest batch failed")
        return jsonify({"error": str(exc)}), 500


@flask_app.route("/symbols", methods=["GET"])
def list_symbols():
    """Return symbols that have price data (for the tester UI)."""
    try:
        symbols = get_symbols_with_prices()
        return jsonify({"data": symbols})
    except Exception as exc:
        logger.exception("Failed to list symbols")
        return jsonify({"error": str(exc)}), 500


def _serialise_batch(batch: dict) -> dict:
    """Make a batch result JSON-serialisable (handle datetime, ObjectId)."""
    import json
    from bson import ObjectId

    def _default(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    # Round-trip through json to handle nested objects
    return json.loads(json.dumps(batch, default=_default))


def _start_flask() -> None:
    """Run the Flask server in a daemon thread."""
    flask_app.run(
        host="0.0.0.0",
        port=FLASK_PORT,
        debug=False,
        use_reloader=False,
    )


# --------------------------------------------------------------------------- #
# Startup
# --------------------------------------------------------------------------- #


def backfill() -> None:
    """Fetch full historical data for every active watchlist item on startup."""
    logger.info("Starting historical backfill …")
    try:
        results = fetch_all_watchlist()
        total = sum(sum(tf.values()) for tf in results.values())
        logger.info(
            "Backfill complete – %d symbols, %d total candles stored",
            len(results),
            total,
        )
    except Exception:
        logger.exception("Backfill failed")


def main() -> None:
    """Application entry point."""
    _configure_logging()
    logger.info("Analysis microservice starting …")

    # Verify connections early
    try:
        get_db()
    except Exception:
        logger.critical("Cannot connect to MongoDB – exiting")
        sys.exit(1)

    try:
        get_redis()
    except Exception:
        logger.critical("Cannot connect to Redis – exiting")
        sys.exit(1)

    # Sync discovered strategies to MongoDB
    logger.info(
        "Discovered %d strategies: %s",
        len(STRATEGY_META),
        list(STRATEGY_META.keys()),
    )
    sync_strategies(STRATEGY_META)

    # Historical backfill
    backfill()

    # Start Flask HTTP server in a daemon thread
    flask_thread = threading.Thread(target=_start_flask, daemon=True)
    flask_thread.start()
    logger.info("Flask HTTP server started on port %d", FLASK_PORT)

    # Start Redis subscriber for immediate data collection on new tickers
    watchlist_thread = threading.Thread(
        target=subscribe_watchlist_added,
        args=(_handle_watchlist_added,),
        daemon=True,
    )
    watchlist_thread.start()
    logger.info(
        "Watchlist subscriber started – new tickers will be fetched immediately"
    )

    # Scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        fetch_and_analyze,
        "interval",
        minutes=2,
        id="fetch_and_analyze",
        next_run_time=datetime.now(timezone.utc),  # also run immediately
    )
    scheduler.start()
    logger.info("Scheduler started – running every 2 minutes")

    # Graceful shutdown
    shutdown_requested = False

    def _handle_signal(signum: int, frame: Any) -> None:
        nonlocal shutdown_requested
        sig_name = signal.Signals(signum).name
        logger.info("Received %s – shutting down …", sig_name)
        shutdown_requested = True

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    # Main loop
    try:
        while not shutdown_requested:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        logger.info("Shutting down scheduler …")
        scheduler.shutdown(wait=False)
        logger.info("Analysis microservice stopped.")


if __name__ == "__main__":
    main()
