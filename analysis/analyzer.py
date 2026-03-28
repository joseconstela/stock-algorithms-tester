"""
Multi-timeframe analysis orchestrator.

For each symbol the orchestrator:
1. Loads candles from MongoDB for every requested timeframe.
2. Computes technical indicators.
3. Runs each enabled strategy.
4. Aggregates the signals using weighted timeframe scoring.
5. Returns a single consolidated signal (or ``None``).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from config import (
    DEFAULT_TIMEFRAMES,
    SIGNAL_COOLDOWN_MINUTES,
    SIGNAL_WEIGHTS,
)
from db import get_candles, get_last_signal, save_indicator_values
from indicators import compute_indicators
from strategies import STRATEGY_REGISTRY, get_all_strategy_names

logger = logging.getLogger(__name__)


def analyze_symbol(
    symbol: str,
    timeframes: list[str] | None = None,
    strategies: list[str] | None = None,
    cooldown_minutes: int | None = None,
) -> dict[str, Any] | None:
    """Run multi-timeframe analysis for a single *symbol*.

    Parameters
    ----------
    symbol:
        Ticker symbol (with exchange suffix if applicable).
    timeframes:
        Timeframes to analyse.  Defaults to :pydata:`config.DEFAULT_TIMEFRAMES`.
    strategies:
        Strategy names to evaluate.  Defaults to :pydata:`config.DEFAULT_STRATEGIES`.
    cooldown_minutes:
        Minimum minutes between signals of the same type for this symbol.
        Per-symbol watchlist value takes priority; falls back to
        ``config.SIGNAL_COOLDOWN_MINUTES``.

    Returns
    -------
    dict | None
        Aggregated signal dict with keys:
        ``type, strength, symbol, timeframe_signals, best_signal, timestamp``
        or ``None`` if no clear signal emerges.
    """
    if timeframes is None:
        timeframes = DEFAULT_TIMEFRAMES
    if strategies is None:
        strategies = get_all_strategy_names()
    if cooldown_minutes is None:
        cooldown_minutes = SIGNAL_COOLDOWN_MINUTES

    # Collect signals per timeframe
    timeframe_signals: dict[str, list[dict[str, Any]]] = {}

    for tf in timeframes:
        tf_signals = _analyze_timeframe(symbol, tf, strategies)
        if tf_signals:
            timeframe_signals[tf] = tf_signals

    if not timeframe_signals:
        logger.debug("No signals generated for %s across any timeframe", symbol)
        return None

    # Aggregate across timeframes
    aggregated = _aggregate_signals(symbol, timeframe_signals)

    if aggregated is None:
        return None

    # ── Cooldown check (per signal type) ──────────────────────────────
    if not _passes_cooldown(symbol, aggregated["type"], cooldown_minutes):
        return None

    return aggregated


def _passes_cooldown(symbol: str, signal_type: str, cooldown_minutes: int) -> bool:
    """Return ``True`` if enough time has passed since the last signal of this type."""
    from datetime import timedelta

    last = get_last_signal(symbol, signal_type)
    if last is None:
        return True

    created = last.get("createdAt")
    if created is None:
        return True

    # Ensure timezone-aware comparison
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)

    elapsed = datetime.now(timezone.utc) - created
    cooldown = timedelta(minutes=cooldown_minutes)

    if elapsed < cooldown:
        remaining = cooldown - elapsed
        logger.info(
            "Signal suppressed for %s (%s): cooldown %dm, %s remaining",
            symbol,
            signal_type.upper(),
            cooldown_minutes,
            str(remaining).split(".")[0],
        )
        return False

    return True


# --------------------------------------------------------------------------- #
# Per-timeframe analysis
# --------------------------------------------------------------------------- #


def _analyze_timeframe(
    symbol: str,
    timeframe: str,
    strategies: list[str],
) -> list[dict[str, Any]]:
    """Compute indicators and run strategies for one timeframe.

    Returns a list of signal dicts produced by the enabled strategies.
    """
    df = get_candles(symbol, timeframe)
    if df.empty:
        logger.debug("No candles for %s/%s – skipping", symbol, timeframe)
        return []

    # Compute indicators
    df, latest_indicators = compute_indicators(df)

    # Persist latest indicator snapshot to the price document
    if latest_indicators and not df.empty:
        last_ts = df["timestamp"].iloc[-1]
        if isinstance(last_ts, pd.Timestamp):
            last_ts = last_ts.to_pydatetime()
        try:
            save_indicator_values(symbol, timeframe, last_ts, latest_indicators)
        except Exception:
            logger.exception(
                "Failed to save indicator values for %s/%s",
                symbol,
                timeframe,
            )

    # Run each strategy
    signals: list[dict[str, Any]] = []
    for strat_name in strategies:
        fn = STRATEGY_REGISTRY.get(strat_name)
        if fn is None:
            logger.warning("Unknown strategy '%s' – skipping", strat_name)
            continue
        try:
            sig = fn(df)
            if sig is not None:
                sig["symbol"] = symbol
                sig["timeframe"] = timeframe
                sig["price"] = float(df.iloc[-1]["close"])
                sig["timestamp"] = datetime.now(timezone.utc)
                signals.append(sig)
                logger.info(
                    "Signal: %s %s on %s/%s (strength=%d, strategy=%s)",
                    sig["type"].upper(),
                    symbol,
                    timeframe,
                    sig["strategy"],
                    sig["strength"],
                    sig["strategy"],
                )
        except Exception:
            logger.exception(
                "Strategy '%s' failed for %s/%s",
                strat_name,
                symbol,
                timeframe,
            )

    return signals


# --------------------------------------------------------------------------- #
# Aggregation
# --------------------------------------------------------------------------- #


def _aggregate_signals(
    symbol: str,
    timeframe_signals: dict[str, list[dict[str, Any]]],
) -> dict[str, Any] | None:
    """Aggregate signals across multiple timeframes into a single verdict.

    Scoring rules:
    - Each signal's strength is multiplied by the timeframe weight.
    - Buy and sell scores are accumulated separately.
    - Conflicting directions reduce the final strength.
    - The *best signal* is the highest-weighted timeframe that produced a signal.

    Returns ``None`` if the net score is inconclusive (strength < 10).
    """
    buy_score: float = 0.0
    sell_score: float = 0.0
    buy_count: int = 0
    sell_count: int = 0
    best_signal: dict[str, Any] | None = None
    best_weight: int = 0
    all_signals: list[dict[str, Any]] = []

    for tf, signals in timeframe_signals.items():
        weight = SIGNAL_WEIGHTS.get(tf, 1)
        for sig in signals:
            all_signals.append(sig)
            weighted_strength = sig["strength"] * weight

            if sig["type"] == "buy":
                buy_score += weighted_strength
                buy_count += 1
            elif sig["type"] == "sell":
                sell_score += weighted_strength
                sell_count += 1

            # Track the best (highest-weighted) individual signal
            if weight > best_weight or (
                weight == best_weight
                and (best_signal is None or sig["strength"] > best_signal["strength"])
            ):
                best_weight = weight
                best_signal = sig

    # Determine net direction
    if buy_score > sell_score:
        direction = "buy"
        net_score = buy_score - sell_score * 0.5  # conflicting signals penalise
        agreement_bonus = min(20, (buy_count - 1) * 10) if buy_count > 1 else 0
    elif sell_score > buy_score:
        direction = "sell"
        net_score = sell_score - buy_score * 0.5
        agreement_bonus = min(20, (sell_count - 1) * 10) if sell_count > 1 else 0
    else:
        # Perfect tie – hold
        return None

    # Normalise to 0-100 scale
    total_weight = sum(SIGNAL_WEIGHTS.get(tf, 1) for tf in timeframe_signals)
    max_possible = total_weight * 100  # theoretical maximum
    if max_possible == 0:
        return None

    strength = int((net_score / max_possible) * 100) + agreement_bonus
    strength = max(0, min(100, strength))

    if strength < 10:
        logger.debug(
            "Aggregated strength for %s too low (%d) – returning None",
            symbol,
            strength,
        )
        return None

    aggregated: dict[str, Any] = {
        "symbol": symbol,
        "type": direction,
        "strength": strength,
        "strategy": best_signal["strategy"] if best_signal else "unknown",
        "timeframe": best_signal["timeframe"] if best_signal else "1d",
        "price": best_signal["price"] if best_signal else 0,
        "timestamp": datetime.now(timezone.utc),
        "timeframe_signals": [
            {
                "timeframe": s["timeframe"],
                "type": s["type"],
                "strength": s["strength"],
                "strategy": s["strategy"],
                "reason": s.get("reason", ""),
            }
            for s in all_signals
        ],
        "best_signal": {
            "timeframe": best_signal["timeframe"],
            "type": best_signal["type"],
            "strength": best_signal["strength"],
            "strategy": best_signal["strategy"],
            "reason": best_signal.get("reason", ""),
        }
        if best_signal
        else None,
    }

    logger.info(
        "Aggregated signal: %s %s strength=%d (buy_score=%.0f, sell_score=%.0f, "
        "buy_count=%d, sell_count=%d)",
        direction.upper(),
        symbol,
        strength,
        buy_score,
        sell_score,
        buy_count,
        sell_count,
    )

    return aggregated
