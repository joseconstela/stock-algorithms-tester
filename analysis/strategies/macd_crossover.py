"""
Strategy: MACD Crossover

MACD signal-line crossover.

Buy:  MACD crosses above signal AND histogram turns positive
Sell: MACD crosses below signal AND histogram turns negative
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from strategies._helpers import (
    any_nan,
    clamp,
    crossed_above,
    crossed_below,
    has_columns,
    safe,
)

STRATEGY = {
    "name": "macd_crossover",
    "description": "MACD/signal line crossover with histogram confirmation",
    "parameters": [
        {
            "name": "adx_min_threshold",
            "type": "number",
            "default": 20,
            "min": 10,
            "max": 40,
            "step": 1,
            "description": "Minimum ADX value for trend strength contribution in signal scoring",
        },
        {
            "name": "require_histogram_confirmation",
            "type": "boolean",
            "default": True,
            "description": "Require histogram to be positive (buy) or negative (sell) to confirm the crossover",
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
    """Run MACD crossover analysis on the enriched DataFrame."""
    required = ["macd", "macd_signal", "macd_hist", "adx", "volume"]
    if not has_columns(df, required):
        return None

    if len(df) < 2:
        return None

    p = _get_params(params)
    adx_min = p["adx_min_threshold"]
    require_hist = p["require_histogram_confirmation"]

    last = df.iloc[-1]
    hist_now = last["macd_hist"]
    hist_prev = df["macd_hist"].iloc[-2]

    indicators = {
        "macd": safe(last["macd"]),
        "macd_signal": safe(last["macd_signal"]),
        "macd_hist": safe(hist_now),
        "adx": safe(last["adx"]),
    }

    if any_nan(hist_now, hist_prev):
        return None

    # --- BUY ---
    buy_condition = crossed_above(df["macd"], df["macd_signal"])
    if require_hist:
        buy_condition = buy_condition and hist_now > 0

    if buy_condition:
        strength = _macd_strength(df, direction="buy", adx_min=adx_min)
        return {
            "type": "buy",
            "strength": strength,
            "strategy": "macd_crossover",
            "indicators": indicators,
            "reason": (
                f"MACD crossed above signal line. Histogram={hist_now:.4f}. "
                f"ADX={safe(last['adx'])}."
            ),
        }

    # --- SELL ---
    sell_condition = crossed_below(df["macd"], df["macd_signal"])
    if require_hist:
        sell_condition = sell_condition and hist_now < 0

    if sell_condition:
        strength = _macd_strength(df, direction="sell", adx_min=adx_min)
        return {
            "type": "sell",
            "strength": strength,
            "strategy": "macd_crossover",
            "indicators": indicators,
            "reason": (
                f"MACD crossed below signal line. Histogram={hist_now:.4f}. "
                f"ADX={safe(last['adx'])}."
            ),
        }

    return None


def _macd_strength(df: pd.DataFrame, direction: str, adx_min: float = 20) -> int:
    """Compute MACD crossover signal strength."""
    last = df.iloc[-1]
    base = 50

    # Histogram magnitude contribution (up to +20)
    hist = abs(last["macd_hist"])
    close = last.get("close", 1)
    if pd.notna(hist) and pd.notna(close) and close != 0:
        norm_hist = hist / abs(close) * 1000
        base += min(20, int(norm_hist))

    # ADX trend strength (up to +15)
    adx = last.get("adx", np.nan)
    if pd.notna(adx):
        base += min(15, max(0, int(adx - adx_min)))

    # Volume confirmation (up to +15)
    if "volume" in df.columns and len(df) >= 20:
        avg_vol = df["volume"].iloc[-20:].mean()
        if avg_vol > 0:
            vol_ratio = last["volume"] / avg_vol
            base += min(15, int((vol_ratio - 1) * 15))

    return clamp(base)
