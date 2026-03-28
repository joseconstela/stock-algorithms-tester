"""
Strategy: Moving Average Crossover

EMA(12)/EMA(26) crossover confirmed by SMA trend alignment.

Buy:  EMA(12) crosses above EMA(26) AND price > SMA(50) AND SMA(50) > SMA(200)
Sell: EMA(12) crosses below EMA(26) AND price < SMA(50)
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
    "name": "ma_crossover",
    "description": "EMA(12)/EMA(26) crossover confirmed by SMA trend alignment",
    "parameters": [
        {
            "name": "adx_min_threshold",
            "type": "number",
            "default": 20,
            "min": 10,
            "max": 40,
            "step": 1,
            "description": "Minimum ADX value to consider a trend strong enough (used in strength calculation)",
        },
        {
            "name": "require_sma_alignment",
            "type": "boolean",
            "default": True,
            "description": "For buy signals, require SMA(50) > SMA(200) trend alignment",
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
    """Run MA crossover analysis on the enriched DataFrame."""
    required = ["ema_12", "ema_26", "sma_50", "sma_200", "close", "adx", "volume"]
    if not has_columns(df, required):
        return None

    p = _get_params(params)
    require_sma_alignment = p["require_sma_alignment"]
    adx_min = p["adx_min_threshold"]

    last = df.iloc[-1]
    close = last["close"]
    sma50 = last["sma_50"]
    sma200 = last["sma_200"]
    adx = last["adx"]

    indicators = {
        "ema_12": safe(last["ema_12"]),
        "ema_26": safe(last["ema_26"]),
        "sma_50": safe(sma50),
        "sma_200": safe(sma200),
        "adx": safe(adx),
    }

    if any_nan(close, sma50, sma200):
        return None

    # --- BUY ---
    buy_condition = crossed_above(df["ema_12"], df["ema_26"]) and close > sma50
    if require_sma_alignment:
        buy_condition = buy_condition and sma50 > sma200

    if buy_condition:
        strength = _ma_strength(df, direction="buy", adx_min=adx_min)
        return {
            "type": "buy",
            "strength": strength,
            "strategy": "ma_crossover",
            "indicators": indicators,
            "reason": (
                f"EMA(12) crossed above EMA(26). Price ({close:.2f}) is above "
                f"SMA(50) ({sma50:.2f})"
                + (
                    f" which is above SMA(200) ({sma200:.2f})"
                    if require_sma_alignment
                    else ""
                )
                + f". ADX={safe(adx)}."
            ),
        }

    # --- SELL ---
    if crossed_below(df["ema_12"], df["ema_26"]) and close < sma50:
        strength = _ma_strength(df, direction="sell", adx_min=adx_min)
        return {
            "type": "sell",
            "strength": strength,
            "strategy": "ma_crossover",
            "indicators": indicators,
            "reason": (
                f"EMA(12) crossed below EMA(26). Price ({close:.2f}) is below "
                f"SMA(50) ({sma50:.2f}). ADX={safe(adx)}."
            ),
        }

    return None


def _ma_strength(df: pd.DataFrame, direction: str, adx_min: float = 20) -> int:
    """Compute MA crossover signal strength (0-100)."""
    last = df.iloc[-1]
    base = 50

    # ADX contribution: strong trend adds up to +20
    adx = last.get("adx", np.nan)
    if pd.notna(adx):
        base += min(20, max(0, (adx - adx_min)))

    # Distance from SMA(50): wider gap = stronger trend, up to +15
    close = last["close"]
    sma50 = last["sma_50"]
    if pd.notna(sma50) and sma50 != 0:
        pct_dist = abs(close - sma50) / sma50 * 100
        base += min(15, int(pct_dist * 5))

    # Volume confirmation: above-average volume adds up to +15
    if "volume" in df.columns and len(df) >= 20:
        avg_vol = df["volume"].iloc[-20:].mean()
        if avg_vol > 0:
            vol_ratio = last["volume"] / avg_vol
            base += min(15, int((vol_ratio - 1) * 15))

    return clamp(base)
