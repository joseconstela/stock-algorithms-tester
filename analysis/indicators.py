"""
Technical indicator computation module.

Uses ``pandas-ta`` to compute a comprehensive set of indicators on an
OHLCV DataFrame.  The public API intentionally returns both the enriched
DataFrame **and** a flat dictionary of the latest values so that callers
can choose to work with the full time-series or just the most recent
snapshot.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
import pandas_ta as ta

from config import INDICATOR_PARAMS

logger = logging.getLogger(__name__)

# Minimum number of rows required to compute the slowest default indicator
# (SMA-200 needs at least 200 data points for a non-NaN result).
_MIN_ROWS_FULL = 200
_MIN_ROWS_BASIC = 30  # Enough for MACD / Bollinger / RSI


def compute_indicators(
    df: pd.DataFrame,
    params: dict | None = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Compute technical indicators and append them as new columns.

    Parameters
    ----------
    df:
        OHLCV DataFrame with at least ``open, high, low, close, volume``
        columns.  Must be sorted ascending by time.
    params:
        Override default indicator parameters.  Structure mirrors
        :pydata:`config.INDICATOR_PARAMS`.

    Returns
    -------
    tuple[pd.DataFrame, dict[str, Any]]
        - The input DataFrame with indicator columns appended.
        - A flat dict of the latest (most recent bar) indicator values,
          suitable for embedding into the ``indicators`` field of a price
          document.
    """
    if df is None or df.empty:
        logger.debug("compute_indicators called with empty DataFrame")
        return df, {}

    p = {**INDICATOR_PARAMS, **(params or {})}
    df = df.copy()

    n_rows = len(df)
    if n_rows < _MIN_ROWS_BASIC:
        logger.warning(
            "Only %d rows – some indicators will be NaN (need >= %d for basics)",
            n_rows,
            _MIN_ROWS_BASIC,
        )

    # ------------------------------------------------------------------ #
    # Simple & Exponential Moving Averages
    # ------------------------------------------------------------------ #
    sma_p = p["sma"]
    df["sma_20"] = ta.sma(df["close"], length=sma_p["short"])
    df["sma_50"] = ta.sma(df["close"], length=sma_p["medium"])
    df["sma_200"] = ta.sma(df["close"], length=sma_p["long"])

    ema_p = p["ema"]
    df["ema_12"] = ta.ema(df["close"], length=ema_p["fast"])
    df["ema_26"] = ta.ema(df["close"], length=ema_p["slow"])

    # ------------------------------------------------------------------ #
    # RSI
    # ------------------------------------------------------------------ #
    rsi_p = p["rsi"]
    df["rsi"] = ta.rsi(df["close"], length=rsi_p["period"])

    # ------------------------------------------------------------------ #
    # MACD
    # ------------------------------------------------------------------ #
    macd_p = p["macd"]
    macd_result = ta.macd(
        df["close"],
        fast=macd_p["fast"],
        slow=macd_p["slow"],
        signal=macd_p["signal"],
    )
    if macd_result is not None and not macd_result.empty:
        df["macd"] = macd_result.iloc[:, 0]
        df["macd_signal"] = macd_result.iloc[:, 1]
        df["macd_hist"] = macd_result.iloc[:, 2]
    else:
        df["macd"] = np.nan
        df["macd_signal"] = np.nan
        df["macd_hist"] = np.nan

    # ------------------------------------------------------------------ #
    # Bollinger Bands
    # ------------------------------------------------------------------ #
    bb_p = p["bollinger"]
    bb_result = ta.bbands(df["close"], length=bb_p["period"], std=bb_p["std_dev"])
    if bb_result is not None and not bb_result.empty:
        # pandas-ta bbands columns: BBL, BBM, BBU, BBB, BBP
        df["bb_lower"] = bb_result.iloc[:, 0]
        df["bb_middle"] = bb_result.iloc[:, 1]
        df["bb_upper"] = bb_result.iloc[:, 2]
    else:
        df["bb_lower"] = np.nan
        df["bb_middle"] = np.nan
        df["bb_upper"] = np.nan

    # ------------------------------------------------------------------ #
    # ATR
    # ------------------------------------------------------------------ #
    atr_p = p["atr"]
    df["atr"] = ta.atr(df["high"], df["low"], df["close"], length=atr_p["period"])

    # ------------------------------------------------------------------ #
    # ADX
    # ------------------------------------------------------------------ #
    adx_p = p["adx"]
    adx_result = ta.adx(df["high"], df["low"], df["close"], length=adx_p["period"])
    if adx_result is not None and not adx_result.empty:
        # Columns: ADX_14, DMP_14, DMN_14
        df["adx"] = adx_result.iloc[:, 0]
    else:
        df["adx"] = np.nan

    # ------------------------------------------------------------------ #
    # Stochastic Oscillator
    # ------------------------------------------------------------------ #
    stoch_p = p["stochastic"]
    stoch_result = ta.stoch(
        df["high"],
        df["low"],
        df["close"],
        k=stoch_p["k_period"],
        d=stoch_p["d_period"],
        smooth_k=stoch_p["smooth_k"],
    )
    if stoch_result is not None and not stoch_result.empty:
        df["stoch_k"] = stoch_result.iloc[:, 0]
        df["stoch_d"] = stoch_result.iloc[:, 1]
    else:
        df["stoch_k"] = np.nan
        df["stoch_d"] = np.nan

    # ------------------------------------------------------------------ #
    # VWAP (meaningful only for intraday data with volume)
    # ------------------------------------------------------------------ #
    try:
        vwap = ta.vwap(df["high"], df["low"], df["close"], df["volume"])
        if vwap is not None and not vwap.empty:
            df["vwap"] = vwap
        else:
            df["vwap"] = np.nan
    except Exception:
        # VWAP may fail if there's no intraday index; that's fine.
        df["vwap"] = np.nan

    # ------------------------------------------------------------------ #
    # OBV (On Balance Volume)
    # ------------------------------------------------------------------ #
    obv = ta.obv(df["close"], df["volume"])
    if obv is not None and not obv.empty:
        df["obv"] = obv
    else:
        df["obv"] = np.nan

    # ------------------------------------------------------------------ #
    # Build the latest-values snapshot
    # ------------------------------------------------------------------ #
    latest = _extract_latest(df)

    return df, latest


def _extract_latest(df: pd.DataFrame) -> dict[str, Any]:
    """Extract the most recent row's indicator values as a plain dict.

    NaN / inf values are omitted so the dict is safe for MongoDB storage.
    """
    if df.empty:
        return {}

    last_row = df.iloc[-1]
    indicator_cols = [
        "sma_20",
        "sma_50",
        "sma_200",
        "ema_12",
        "ema_26",
        "rsi",
        "macd",
        "macd_signal",
        "macd_hist",
        "bb_lower",
        "bb_middle",
        "bb_upper",
        "atr",
        "adx",
        "stoch_k",
        "stoch_d",
        "vwap",
        "obv",
    ]

    result: dict[str, Any] = {}
    for col in indicator_cols:
        if col in last_row.index:
            val = last_row[col]
            if pd.notna(val) and np.isfinite(val):
                result[col] = round(float(val), 6)

    return result
