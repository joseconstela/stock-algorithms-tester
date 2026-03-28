"""
Data fetching module.

Downloads OHLCV candle data from Yahoo Finance via the ``yfinance`` library.
The module is intentionally thin so that the data-source can be swapped
(e.g. to Twelve Data, Interactive Brokers, or a real-time WebSocket feed)
without modifying the downstream indicator / strategy pipeline.
"""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd
import yfinance as yf

from config import (
    DEFAULT_TIMEFRAMES,
    YFINANCE_INTERVALS,
    YFINANCE_PERIODS,
)
from db import get_watchlist, save_candles

logger = logging.getLogger(__name__)


def fetch_candles(symbol: str, timeframe: str) -> pd.DataFrame | None:
    """Fetch OHLCV candles for *symbol* at the given *timeframe* from Yahoo Finance.

    Parameters
    ----------
    symbol:
        Ticker symbol **including** any exchange suffix
        (e.g. ``ASML.AS``, ``SAP.DE``, ``AAPL``).
    timeframe:
        One of the keys in :pydata:`config.YFINANCE_INTERVALS`
        (``'1m'``, ``'5m'``, ``'15m'``, ``'30m'``, ``'1h'``, ``'1d'``, ``'1wk'``).

    Returns
    -------
    pd.DataFrame | None
        DataFrame with columns ``[open, high, low, close, volume, timestamp]``,
        sorted ascending by timestamp.  Returns ``None`` on error.
    """
    interval = YFINANCE_INTERVALS.get(timeframe)
    period = YFINANCE_PERIODS.get(timeframe)

    if interval is None or period is None:
        logger.error("Unsupported timeframe '%s' for symbol %s", timeframe, symbol)
        return None

    try:
        logger.info("Fetching %s candles for %s (period=%s)", timeframe, symbol, period)
        ticker = yf.Ticker(symbol)
        hist: pd.DataFrame = ticker.history(period=period, interval=interval)

        if hist.empty:
            logger.warning("No data returned by yfinance for %s/%s", symbol, timeframe)
            return None

        # yfinance returns the datetime index; convert to a regular column first
        hist = hist.reset_index()

        # Normalise all column names to lowercase (including the former index)
        hist.columns = [c.lower().replace(" ", "_") for c in hist.columns]

        # The index column name varies: 'date' for daily+, 'datetime' for intraday
        date_col = "date" if "date" in hist.columns else "datetime"
        hist = hist.rename(columns={date_col: "timestamp"})

        # Ensure timestamps are timezone-aware (UTC)
        if hist["timestamp"].dt.tz is None:
            hist["timestamp"] = hist["timestamp"].dt.tz_localize("UTC")
        else:
            hist["timestamp"] = hist["timestamp"].dt.tz_convert("UTC")

        # Keep only the columns we need
        keep = ["open", "high", "low", "close", "volume", "timestamp"]
        hist = hist[[c for c in keep if c in hist.columns]]

        # Drop rows with NaN prices
        hist = hist.dropna(subset=["open", "high", "low", "close"])

        logger.info("Fetched %d candles for %s/%s", len(hist), symbol, timeframe)
        return hist

    except Exception:
        logger.exception("Error fetching candles for %s/%s", symbol, timeframe)
        return None


def fetch_all_watchlist(
    timeframes: list[str] | None = None,
) -> dict[str, dict[str, int]]:
    """Fetch candles for every active watchlist item and persist to MongoDB.

    Parameters
    ----------
    timeframes:
        List of timeframe strings to fetch.  Defaults to
        :pydata:`config.DEFAULT_TIMEFRAMES`.

    Returns
    -------
    dict
        Nested mapping ``{symbol: {timeframe: saved_count}}`` summarising
        how many candles were stored for each combination.
    """
    if timeframes is None:
        timeframes = DEFAULT_TIMEFRAMES

    watchlist: list[dict[str, Any]] = get_watchlist()
    if not watchlist:
        logger.warning("Watchlist is empty – nothing to fetch")
        return {}

    results: dict[str, dict[str, int]] = {}

    for item in watchlist:
        symbol: str = item.get("symbol", "")
        if not symbol:
            continue

        # Allow per-item timeframe overrides stored in the watchlist document
        item_timeframes = item.get("timeframes", timeframes)
        results[symbol] = {}

        for tf in item_timeframes:
            try:
                df = fetch_candles(symbol, tf)
                if df is not None and not df.empty:
                    count = save_candles(symbol, tf, df)
                    results[symbol][tf] = count
                else:
                    results[symbol][tf] = 0
            except Exception:
                logger.exception(
                    "Failed to fetch/save candles for %s/%s",
                    symbol,
                    tf,
                )
                results[symbol][tf] = 0

    return results
