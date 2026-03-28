"""
Strategy: RSI Reversal

RSI mean-reversion strategy.

Buy:  RSI crosses above 30 (from oversold)
Sell: RSI crosses below 70 (from overbought)
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from strategies._helpers import any_nan, clamp, has_columns, safe

STRATEGY = {
    "name": "rsi_reversal",
    "description": "RSI mean-reversion: buy on oversold bounce, sell on overbought drop",
    "parameters": [
        {
            "name": "oversold_threshold",
            "type": "number",
            "default": 30,
            "min": 10,
            "max": 50,
            "step": 1,
            "description": "RSI level considered oversold (buy when RSI crosses above this)",
        },
        {
            "name": "overbought_threshold",
            "type": "number",
            "default": 70,
            "min": 50,
            "max": 90,
            "step": 1,
            "description": "RSI level considered overbought (sell when RSI crosses below this)",
        },
    ],
}


def _get_params(params: dict[str, Any] | None) -> dict[str, Any]:
    """Merge user-supplied params with defaults from STRATEGY['parameters']."""
    defaults = {p["name"]: p["default"] for p in STRATEGY["parameters"]}
    if params:
        defaults.update(params)
    return defaults


def analyze(
    df: pd.DataFrame, params: dict[str, Any] | None = None
) -> dict[str, Any] | None:
    """Run RSI reversal analysis on the enriched DataFrame."""
    required = ["rsi", "stoch_k", "close", "bb_lower", "bb_upper"]
    if not has_columns(df, required):
        return None

    if len(df) < 2:
        return None

    p = _get_params(params)
    oversold = p["oversold_threshold"]
    overbought = p["overbought_threshold"]

    rsi_now = df["rsi"].iloc[-1]
    rsi_prev = df["rsi"].iloc[-2]
    last = df.iloc[-1]

    indicators = {
        "rsi": safe(rsi_now),
        "stoch_k": safe(last["stoch_k"]),
        "bb_lower": safe(last["bb_lower"]),
        "bb_upper": safe(last["bb_upper"]),
    }

    if any_nan(rsi_now, rsi_prev):
        return None

    # --- BUY: RSI crosses above oversold threshold from below ---
    if rsi_prev <= oversold and rsi_now > oversold:
        strength = _rsi_strength(
            df, direction="buy", oversold=oversold, overbought=overbought
        )
        return {
            "type": "buy",
            "strength": strength,
            "strategy": "rsi_reversal",
            "indicators": indicators,
            "reason": (
                f"RSI crossed above {oversold} (prev={rsi_prev:.1f}, now={rsi_now:.1f}). "
                f"Stoch %K={safe(last['stoch_k'])}."
            ),
        }

    # --- SELL: RSI crosses below overbought threshold from above ---
    if rsi_prev >= overbought and rsi_now < overbought:
        strength = _rsi_strength(
            df, direction="sell", oversold=oversold, overbought=overbought
        )
        return {
            "type": "sell",
            "strength": strength,
            "strategy": "rsi_reversal",
            "indicators": indicators,
            "reason": (
                f"RSI crossed below {overbought} (prev={rsi_prev:.1f}, now={rsi_now:.1f}). "
                f"Stoch %K={safe(last['stoch_k'])}."
            ),
        }

    return None


def _rsi_strength(
    df: pd.DataFrame, direction: str, oversold: float = 30, overbought: float = 70
) -> int:
    """Compute RSI reversal signal strength."""
    last = df.iloc[-1]
    base = 50

    rsi = last["rsi"]
    # RSI extremity: the further from the threshold the recent extreme was, the stronger
    if direction == "buy" and pd.notna(rsi):
        base += min(20, int((oversold - min(rsi, oversold)) * 2))
    elif direction == "sell" and pd.notna(rsi):
        base += min(20, int((max(rsi, overbought) - overbought) * 2))

    # Stochastic confirmation
    stoch_k = last.get("stoch_k", np.nan)
    if pd.notna(stoch_k):
        if direction == "buy" and stoch_k < oversold:
            base += 15
        elif direction == "sell" and stoch_k > overbought:
            base += 15

    # Bollinger Band confirmation
    close = last["close"]
    bb_lower = last.get("bb_lower", np.nan)
    bb_upper = last.get("bb_upper", np.nan)
    if direction == "buy" and pd.notna(bb_lower) and close <= bb_lower:
        base += 15
    elif direction == "sell" and pd.notna(bb_upper) and close >= bb_upper:
        base += 15

    return clamp(base)
