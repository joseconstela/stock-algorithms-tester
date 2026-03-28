"""
Shared helper functions for strategy modules.

These utilities are used across all built-in strategies for crossover
detection, NaN handling, clamping, and column validation.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def crossed_above(series_a: pd.Series, series_b: pd.Series) -> bool:
    """Return True if *series_a* crossed above *series_b* on the most recent bar.

    A crossover is detected when the previous bar had ``a <= b`` and the
    current bar has ``a > b``.
    """
    if len(series_a) < 2 or len(series_b) < 2:
        return False
    prev_a, curr_a = series_a.iloc[-2], series_a.iloc[-1]
    prev_b, curr_b = series_b.iloc[-2], series_b.iloc[-1]
    if any_nan(prev_a, curr_a, prev_b, curr_b):
        return False
    return prev_a <= prev_b and curr_a > curr_b


def crossed_below(series_a: pd.Series, series_b: pd.Series) -> bool:
    """Return True if *series_a* crossed below *series_b* on the most recent bar."""
    if len(series_a) < 2 or len(series_b) < 2:
        return False
    prev_a, curr_a = series_a.iloc[-2], series_a.iloc[-1]
    prev_b, curr_b = series_b.iloc[-2], series_b.iloc[-1]
    if any_nan(prev_a, curr_a, prev_b, curr_b):
        return False
    return prev_a >= prev_b and curr_a < curr_b


def any_nan(*values: float) -> bool:
    """Return True if any value is NaN or infinite."""
    return any(pd.isna(v) or (isinstance(v, float) and np.isinf(v)) for v in values)


def safe(val: float) -> float | None:
    """Return *val* rounded to 4 dp, or None if NaN/inf."""
    if pd.isna(val) or (isinstance(val, float) and np.isinf(val)):
        return None
    return round(float(val), 4)


def clamp(value: float, lo: float = 0, hi: float = 100) -> int:
    """Clamp *value* to [lo, hi] and return as int."""
    return int(max(lo, min(hi, value)))


def has_columns(df: pd.DataFrame, cols: list[str]) -> bool:
    """Return True if *df* has all *cols* and at least 2 rows."""
    if df is None or len(df) < 2:
        return False
    missing = [c for c in cols if c not in df.columns]
    if missing:
        logger.debug("DataFrame missing columns: %s", missing)
        return False
    return True
