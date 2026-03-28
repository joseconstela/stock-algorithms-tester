"""
Strategy backtesting module.

Walks through historical candle data with a sliding window approach,
running strategy ``analyze()`` functions at each point in time to detect
all signals that *would* have been generated historically.

This avoids look-ahead bias: at candle index *i*, the strategy only sees
candles ``[0 .. i]``.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
from bson import ObjectId

from config import YFINANCE_INTERVALS
from db import get_candles, get_db
from indicators import compute_indicators
from strategies import STRATEGY_REGISTRY

logger = logging.getLogger(__name__)

# Minimum window size for computing indicators (need at least SMA-200 worth
# of data before we can start generating meaningful signals).
_MIN_WINDOW = 200


def run_backtest(
    symbol: str,
    strategy_name: str,
    timeframe: str,
    execution_id: str | None = None,
    batch_id: str | None = None,
    strategy_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run a sliding-window backtest for one symbol / strategy / timeframe.

    Parameters
    ----------
    symbol:
        Ticker symbol (e.g. ``"AAPL"``).
    strategy_name:
        Name of the registered strategy (e.g. ``"ma_crossover"``).
    timeframe:
        Candle timeframe (e.g. ``"1d"``).
    execution_id:
        ObjectId (as string) of the parent BacktestExecution document.
    batch_id:
        Optional batch identifier linking multiple backtest runs together.
    strategy_params:
        Optional dict of custom parameter overrides for this strategy.

    Returns
    -------
    dict
        The saved backtest result document (including ``_id``).
    """
    db = get_db()
    coll = db["backtest_results"]

    # Create result document upfront with "running" status
    doc: dict[str, Any] = {
        "symbol": symbol,
        "strategy": strategy_name,
        "timeframe": timeframe,
        "signals": [],
        "summary": {},
        "status": "running",
        "error": None,
        "batchId": batch_id,
        "createdAt": datetime.now(timezone.utc),
        "completedAt": None,
    }
    if execution_id:
        doc["executionId"] = ObjectId(execution_id)
    inserted = coll.insert_one(doc)
    doc_id = inserted.inserted_id

    try:
        fn = STRATEGY_REGISTRY.get(strategy_name)
        if fn is None:
            raise ValueError(f"Unknown strategy: {strategy_name}")

        # Load all available candles (large limit for backtesting)
        df = get_candles(symbol, timeframe, limit=5000)
        if df.empty:
            raise ValueError(f"No price data for {symbol}/{timeframe}")

        signals = _walk_candles(df, fn, strategy_name, strategy_params=strategy_params)

        # Build summary
        buy_signals = [s for s in signals if s["type"] == "buy"]
        sell_signals = [s for s in signals if s["type"] == "sell"]
        strengths = [s["strength"] for s in signals]

        summary = {
            "totalSignals": len(signals),
            "buySignals": len(buy_signals),
            "sellSignals": len(sell_signals),
            "avgStrength": round(float(np.mean(strengths)), 1) if strengths else 0,
            "dateRange": {
                "from": df["timestamp"].iloc[0] if not df.empty else None,
                "to": df["timestamp"].iloc[-1] if not df.empty else None,
            },
            "totalCandles": len(df),
        }

        coll.update_one(
            {"_id": doc_id},
            {
                "$set": {
                    "signals": signals,
                    "summary": summary,
                    "status": "completed",
                    "completedAt": datetime.now(timezone.utc),
                }
            },
        )

        doc.update(
            signals=signals,
            summary=summary,
            status="completed",
            completedAt=datetime.now(timezone.utc),
        )
        doc["_id"] = doc_id
        logger.info(
            "Backtest completed: %s/%s/%s – %d signals found",
            symbol,
            strategy_name,
            timeframe,
            len(signals),
        )

    except Exception as exc:
        logger.exception(
            "Backtest failed for %s/%s/%s", symbol, strategy_name, timeframe
        )
        coll.update_one(
            {"_id": doc_id},
            {
                "$set": {
                    "status": "failed",
                    "error": str(exc),
                    "completedAt": datetime.now(timezone.utc),
                }
            },
        )
        doc.update(status="failed", error=str(exc))
        doc["_id"] = doc_id

    return doc


def _walk_candles(
    df: pd.DataFrame,
    strategy_fn,
    strategy_name: str,
    strategy_params: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Walk through candles with a sliding window, running the strategy at each step.

    At each position *i* (starting from ``_MIN_WINDOW``), the strategy receives
    only candles ``[0 .. i]`` so there is no look-ahead bias.
    """
    signals: list[dict[str, Any]] = []
    n = len(df)

    if n < _MIN_WINDOW:
        logger.warning(
            "Only %d candles available (need %d) – running with full dataset",
            n,
            _MIN_WINDOW,
        )
        # Still try with what we have – start from the minimum needed for
        # basic indicators (30 rows).
        start = max(30, 0)
    else:
        start = _MIN_WINDOW

    for i in range(start, n):
        window = df.iloc[: i + 1].copy()

        try:
            # Compute indicators on the window
            enriched, _ = compute_indicators(window)
            if enriched is None or enriched.empty:
                continue

            # Run the strategy
            result = strategy_fn(enriched, params=strategy_params)

            if result is not None:
                row = df.iloc[i]
                ts = row["timestamp"]
                if isinstance(ts, pd.Timestamp):
                    ts = ts.to_pydatetime()

                signals.append(
                    {
                        "type": result["type"],
                        "strength": result["strength"],
                        "timestamp": ts,
                        "price": float(row["close"]),
                        "indicators": result.get("indicators", {}),
                        "reason": result.get("reason", ""),
                    }
                )
        except Exception:
            # Log but don't abort the entire backtest
            logger.debug(
                "Strategy error at candle %d/%d for %s",
                i,
                n,
                strategy_name,
                exc_info=True,
            )

    return signals


def run_backtest_batch(
    symbols: list[str],
    strategies: list[str],
    execution_id: str | None = None,
    strategy_params: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Run backtests for all combinations of symbols x strategies x timeframes.

    For each symbol, all timeframes that have data in MongoDB are tested.

    Parameters
    ----------
    symbols:
        List of ticker symbols.
    strategies:
        List of strategy names.
    execution_id:
        ObjectId (as string) of the parent BacktestExecution document.
    strategy_params:
        Optional dict mapping strategy name -> parameter overrides.
        E.g. ``{"rsi_reversal": {"oversold_threshold": 25}}``.

    Returns
    -------
    dict
        Batch metadata: ``{ batchId, total, completed, failed, totalSignals, results }``.
    """
    batch_id = str(uuid.uuid4())
    db = get_db()

    # Discover which timeframes have data for each symbol
    all_timeframes = list(YFINANCE_INTERVALS.keys())

    results: list[dict[str, Any]] = []
    completed = 0
    failed = 0
    total_signals = 0

    for symbol in symbols:
        for strategy_name in strategies:
            for tf in all_timeframes:
                # Quick check: does this symbol/timeframe have any data?
                count = db["prices"].count_documents(
                    {"symbol": symbol, "timeframe": tf}, limit=1
                )
                if count == 0:
                    continue

                # Get custom params for this specific strategy (if any)
                params_for_strategy = (
                    strategy_params.get(strategy_name) if strategy_params else None
                )

                result = run_backtest(
                    symbol,
                    strategy_name,
                    tf,
                    execution_id=execution_id,
                    batch_id=batch_id,
                    strategy_params=params_for_strategy,
                )
                # Serialise ObjectId for JSON
                result["_id"] = str(result["_id"])
                if "executionId" in result:
                    result["executionId"] = str(result["executionId"])

                if result["status"] == "completed":
                    completed += 1
                    total_signals += result.get("summary", {}).get("totalSignals", 0)
                else:
                    failed += 1

                results.append(result)

    return {
        "batchId": batch_id,
        "total": len(results),
        "completed": completed,
        "failed": failed,
        "totalSignals": total_signals,
        "results": results,
    }
