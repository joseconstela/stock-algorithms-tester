"""
Configuration module for the analysis microservice.

Loads settings from environment variables / .env file and defines
default parameters for timeframes, strategies, indicators, and scoring.
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the same directory as this module
load_dotenv(Path(__file__).resolve().parent / ".env")

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Core connection strings
# ---------------------------------------------------------------------------
MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27018/strategy_tester")
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6380")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

# ---------------------------------------------------------------------------
# Signal cooldown
#   Minimum minutes between signals of the same type (buy/sell) for a symbol.
#   Per-symbol overrides via the watchlist `signalCooldown` field take priority.
# ---------------------------------------------------------------------------
SIGNAL_COOLDOWN_MINUTES: int = int(os.getenv("SIGNAL_COOLDOWN_MINUTES", "30"))

# ---------------------------------------------------------------------------
# Valid yfinance period values (for validation)
# ---------------------------------------------------------------------------
VALID_PERIODS: list[str] = [
    "1d",
    "5d",
    "1mo",
    "3mo",
    "6mo",
    "1y",
    "2y",
    "5y",
    "max",
]

# ---------------------------------------------------------------------------
# All known timeframes and their yfinance interval equivalents
# ---------------------------------------------------------------------------
YFINANCE_INTERVALS: dict[str, str] = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "1d": "1d",
    "1wk": "1wk",
}

# ---------------------------------------------------------------------------
# Timeframes & strategies enabled by default
#   TIMEFRAMES env var: comma-separated list, e.g. "15m,1h,1d"
# ---------------------------------------------------------------------------
_raw_timeframes = os.getenv("TIMEFRAMES", "15m,1h,1d")
DEFAULT_TIMEFRAMES: list[str] = [
    tf.strip() for tf in _raw_timeframes.split(",") if tf.strip()
]
# Validate that each timeframe is known
for _tf in DEFAULT_TIMEFRAMES:
    if _tf not in YFINANCE_INTERVALS:
        _logger.warning(
            "Unknown timeframe '%s' in TIMEFRAMES env var – valid values: %s",
            _tf,
            ", ".join(YFINANCE_INTERVALS.keys()),
        )

# DEFAULT_STRATEGIES is populated dynamically after strategy auto-discovery.
# It will be set by main.py after importing the strategies package.
# This sentinel value is used before discovery runs.
DEFAULT_STRATEGIES: list[str] = []

# ---------------------------------------------------------------------------
# yfinance period mapping (how much history to fetch per timeframe)
#   Configured via HISTORY_{tf} env vars, e.g. HISTORY_1h=6mo
#   Falls back to sensible defaults if not set.
# ---------------------------------------------------------------------------
_PERIOD_DEFAULTS: dict[str, str] = {
    "1m": "1d",
    "5m": "5d",
    "15m": "1mo",
    "30m": "1mo",
    "1h": "3mo",
    "1d": "2y",
    "1wk": "5y",
}

YFINANCE_PERIODS: dict[str, str] = {}
for _tf in YFINANCE_INTERVALS:
    _env_val = os.getenv(f"HISTORY_{_tf}", _PERIOD_DEFAULTS.get(_tf, "1mo"))
    if _env_val not in VALID_PERIODS:
        _logger.warning(
            "Invalid history period '%s' for HISTORY_%s – "
            "valid values: %s. Falling back to '%s'.",
            _env_val,
            _tf,
            ", ".join(VALID_PERIODS),
            _PERIOD_DEFAULTS.get(_tf, "1mo"),
        )
        _env_val = _PERIOD_DEFAULTS.get(_tf, "1mo")
    YFINANCE_PERIODS[_tf] = _env_val

# ---------------------------------------------------------------------------
# Default indicator parameters
# ---------------------------------------------------------------------------
INDICATOR_PARAMS: dict = {
    "sma": {"short": 20, "medium": 50, "long": 200},
    "ema": {"fast": 12, "slow": 26},
    "rsi": {"period": 14},
    "macd": {"fast": 12, "slow": 26, "signal": 9},
    "bollinger": {"period": 20, "std_dev": 2},
    "atr": {"period": 14},
    "adx": {"period": 14},
    "stochastic": {"k_period": 14, "d_period": 3, "smooth_k": 3},
}

# ---------------------------------------------------------------------------
# Multi-timeframe signal weights
#   Higher timeframes carry more weight in the aggregated score.
# ---------------------------------------------------------------------------
SIGNAL_WEIGHTS: dict[str, int] = {
    "1m": 1,
    "5m": 1,
    "15m": 1,
    "30m": 2,
    "1h": 2,
    "1d": 3,
    "1wk": 4,
}
