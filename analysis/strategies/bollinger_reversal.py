"""
Strategy: Bollinger Band Reversal

Bollinger Band mean-reversion strategy.

Buy:  Price touches/pierces lower band AND RSI < 40 AND Stoch %K < 30
Sell: Price touches/pierces upper band AND RSI > 60 AND Stoch %K > 70
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from strategies._helpers import any_nan, clamp, has_columns, safe

STRATEGY = {
    "name": "bollinger_reversal",
    "description": "Bollinger Band mean-reversion with RSI and Stochastic confirmation",
    "parameters": [
        {
            "name": "rsi_buy_threshold",
            "type": "number",
            "default": 40,
            "min": 20,
            "max": 50,
            "step": 1,
            "description": "RSI must be below this level to confirm a buy signal",
        },
        {
            "name": "rsi_sell_threshold",
            "type": "number",
            "default": 60,
            "min": 50,
            "max": 80,
            "step": 1,
            "description": "RSI must be above this level to confirm a sell signal",
        },
        {
            "name": "stoch_buy_threshold",
            "type": "number",
            "default": 30,
            "min": 10,
            "max": 50,
            "step": 1,
            "description": "Stochastic %K must be below this level to confirm a buy signal",
        },
        {
            "name": "stoch_sell_threshold",
            "type": "number",
            "default": 70,
            "min": 50,
            "max": 90,
            "step": 1,
            "description": "Stochastic %K must be above this level to confirm a sell signal",
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
    """Run Bollinger Band reversal analysis on the enriched DataFrame."""
    required = ["close", "bb_lower", "bb_upper", "bb_middle", "rsi", "stoch_k"]
    if not has_columns(df, required):
        return None

    p = _get_params(params)
    rsi_buy = p["rsi_buy_threshold"]
    rsi_sell = p["rsi_sell_threshold"]
    stoch_buy = p["stoch_buy_threshold"]
    stoch_sell = p["stoch_sell_threshold"]

    last = df.iloc[-1]
    close = last["close"]
    bb_lower = last["bb_lower"]
    bb_upper = last["bb_upper"]
    rsi = last["rsi"]
    stoch_k = last["stoch_k"]

    indicators = {
        "close": safe(close),
        "bb_lower": safe(bb_lower),
        "bb_upper": safe(bb_upper),
        "bb_middle": safe(last["bb_middle"]),
        "rsi": safe(rsi),
        "stoch_k": safe(stoch_k),
    }

    if any_nan(close, bb_lower, bb_upper, rsi, stoch_k):
        return None

    # --- BUY ---
    if close <= bb_lower and rsi < rsi_buy and stoch_k < stoch_buy:
        strength = _bb_strength(
            df, direction="buy", rsi_buy=rsi_buy, stoch_buy=stoch_buy
        )
        return {
            "type": "buy",
            "strength": strength,
            "strategy": "bollinger_reversal",
            "indicators": indicators,
            "reason": (
                f"Price ({close:.2f}) at/below lower Bollinger Band ({bb_lower:.2f}). "
                f"RSI={rsi:.1f} < {rsi_buy}, Stoch %K={stoch_k:.1f} < {stoch_buy} confirm oversold."
            ),
        }

    # --- SELL ---
    if close >= bb_upper and rsi > rsi_sell and stoch_k > stoch_sell:
        strength = _bb_strength(
            df, direction="sell", rsi_sell=rsi_sell, stoch_sell=stoch_sell
        )
        return {
            "type": "sell",
            "strength": strength,
            "strategy": "bollinger_reversal",
            "indicators": indicators,
            "reason": (
                f"Price ({close:.2f}) at/above upper Bollinger Band ({bb_upper:.2f}). "
                f"RSI={rsi:.1f} > {rsi_sell}, Stoch %K={stoch_k:.1f} > {stoch_sell} confirm overbought."
            ),
        }

    return None


def _bb_strength(
    df: pd.DataFrame,
    direction: str,
    rsi_buy: float = 40,
    rsi_sell: float = 60,
    stoch_buy: float = 30,
    stoch_sell: float = 70,
) -> int:
    """Compute Bollinger reversal signal strength."""
    last = df.iloc[-1]
    base = 50

    # Band width (squeeze = narrower bands = stronger breakout potential)
    bb_upper = last.get("bb_upper", np.nan)
    bb_lower = last.get("bb_lower", np.nan)
    bb_middle = last.get("bb_middle", np.nan)
    if (
        pd.notna(bb_upper)
        and pd.notna(bb_lower)
        and pd.notna(bb_middle)
        and bb_middle != 0
    ):
        bandwidth = (bb_upper - bb_lower) / bb_middle
        if bandwidth < 0.04:
            base += 20
        elif bandwidth < 0.08:
            base += 10

    # RSI extremity
    rsi = last.get("rsi", np.nan)
    if pd.notna(rsi):
        if direction == "buy":
            base += min(15, int((rsi_buy - min(rsi, rsi_buy)) * 1.5))
        else:
            base += min(15, int((max(rsi, rsi_sell) - rsi_sell) * 1.5))

    # Stochastic extremity
    stoch_k = last.get("stoch_k", np.nan)
    if pd.notna(stoch_k):
        if direction == "buy" and stoch_k < stoch_buy:
            base += 15
        elif direction == "sell" and stoch_k > stoch_sell:
            base += 15

    return clamp(base)
