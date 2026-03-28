"""
MongoDB helper module.

Provides convenience functions for reading and writing candles, signals,
watchlist items, and indicator snapshots using pymongo.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from config import MONGODB_URI
from pymongo import MongoClient, UpdateOne
from pymongo.database import Database

logger = logging.getLogger(__name__)

# Module-level singleton – lazily initialised by get_db().
_client: MongoClient | None = None
_db: Database | None = None


def get_db() -> Database:
    """Return the shared MongoDB database connection (singleton).

    The connection is established on first call and reused afterwards.
    """
    global _client, _db
    if _db is None:
        logger.info("Connecting to MongoDB at %s", MONGODB_URI)
        _client = MongoClient(MONGODB_URI)
        # Database name is the path component of the URI (e.g. "strategy_tester")
        db_name = MONGODB_URI.rsplit("/", 1)[-1].split("?")[0] or "strategy_tester"
        _db = _client[db_name]
        # Ensure indexes exist
        _ensure_indexes(_db)
        logger.info("MongoDB connection established – database: %s", db_name)
    return _db


def _ensure_indexes(db: Database) -> None:
    """Create necessary indexes if they don't already exist.

    Indexes on collections shared with the Node.js backend (e.g. watchlists)
    may already exist with different options (Mongoose creates unique indexes).
    We wrap each call so a conflict on one index doesn't prevent the others.
    """
    _safe_create_index(
        db["prices"],
        [("symbol", 1), ("timeframe", 1), ("timestamp", 1)],
        unique=True,
        background=True,
    )
    _safe_create_index(
        db["signals"],
        [("symbol", 1), ("timestamp", -1)],
        background=True,
    )
    _safe_create_index(
        db["backtest_results"],
        [("symbol", 1), ("strategy", 1), ("timeframe", 1)],
        background=True,
    )
    _safe_create_index(
        db["backtest_results"],
        [("batchId", 1)],
        background=True,
    )
    # watchlists index is already created by Mongoose (unique: true) —
    # skip creating it here to avoid IndexKeySpecsConflict errors.


def _safe_create_index(collection, keys, **kwargs) -> None:
    """Attempt to create an index, ignoring conflicts with existing indexes."""
    try:
        collection.create_index(keys, **kwargs)
    except Exception as exc:
        logger.warning("Index creation skipped on %s: %s", collection.name, exc)


# --------------------------------------------------------------------------- #
# Candle helpers
# --------------------------------------------------------------------------- #


def save_candles(symbol: str, timeframe: str, candles_df: pd.DataFrame) -> int:
    """Upsert OHLCV candles from a pandas DataFrame into the ``prices`` collection.

    Uses a bulk upsert keyed on ``{symbol, timeframe, timestamp}``.

    Returns:
        The number of upserted / modified documents.
    """
    if candles_df is None or candles_df.empty:
        logger.debug(
            "save_candles called with empty DataFrame for %s/%s", symbol, timeframe
        )
        return 0

    db = get_db()
    ops: list[UpdateOne] = []

    for _, row in candles_df.iterrows():
        ts = row["timestamp"]
        # Normalise numpy/pandas timestamps to Python datetime
        if isinstance(ts, pd.Timestamp):
            ts = ts.to_pydatetime()

        filt = {"symbol": symbol, "timeframe": timeframe, "timestamp": ts}
        update = {
            "$set": {
                "symbol": symbol,
                "timeframe": timeframe,
                "timestamp": ts,
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": int(row["volume"]),
                "updatedAt": datetime.now(timezone.utc),
            }
        }
        ops.append(UpdateOne(filt, update, upsert=True))

    if ops:
        result = db["prices"].bulk_write(ops, ordered=False)
        total = result.upserted_count + result.modified_count
        logger.info(
            "Saved %d candles for %s/%s (upserted=%d, modified=%d)",
            total,
            symbol,
            timeframe,
            result.upserted_count,
            result.modified_count,
        )
        return total
    return 0


def get_candles(symbol: str, timeframe: str, limit: int = 500) -> pd.DataFrame:
    """Retrieve candles from MongoDB sorted by timestamp descending.

    Returns a pandas DataFrame with columns:
    ``open, high, low, close, volume, timestamp`` (plus any ``indicators``
    sub-document if present).  The DataFrame is re-sorted in ascending
    timestamp order for downstream computation.
    """
    db = get_db()
    cursor = (
        db["prices"]
        .find({"symbol": symbol, "timeframe": timeframe})
        .sort("timestamp", -1)
        .limit(limit)
    )
    docs = list(cursor)

    if not docs:
        logger.debug("No candles found for %s/%s", symbol, timeframe)
        return pd.DataFrame()

    df = pd.DataFrame(docs)

    # Keep only the columns we need (drop _id, etc.)
    keep = ["open", "high", "low", "close", "volume", "timestamp"]
    extra = [c for c in df.columns if c not in keep and c != "_id"]
    df = df[[c for c in keep + extra if c in df.columns]]

    # Sort ascending for indicator computation
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


# --------------------------------------------------------------------------- #
# Signal helpers
# --------------------------------------------------------------------------- #


def save_signal(signal_dict: dict[str, Any]) -> str | None:
    """Insert a signal document. Returns the inserted _id as a string."""
    db = get_db()
    signal_dict.setdefault("createdAt", datetime.now(timezone.utc))
    result = db["signals"].insert_one(signal_dict)
    logger.info("Saved signal %s for %s", result.inserted_id, signal_dict.get("symbol"))
    return str(result.inserted_id)


def get_last_signal(symbol: str, signal_type: str) -> dict[str, Any] | None:
    """Return the most recent signal matching *symbol* and *signal_type*.

    Parameters
    ----------
    symbol:
        Ticker symbol.
    signal_type:
        Signal direction: ``"buy"`` or ``"sell"``.

    Returns
    -------
    dict | None
        The most recent signal document, or ``None`` if none exists.
    """
    db = get_db()
    doc = db["signals"].find_one(
        {"symbol": symbol, "type": signal_type},
        sort=[("createdAt", -1)],
    )
    return doc


# --------------------------------------------------------------------------- #
# Watchlist helpers
# --------------------------------------------------------------------------- #


def get_watchlist() -> list[dict[str, Any]]:
    """Return all *active* watchlist items.

    An item is considered active when it has no ``active`` field (legacy docs)
    or when ``active`` is truthy.
    """
    db = get_db()
    items = list(
        db["watchlists"].find(
            {"$or": [{"active": True}, {"active": {"$exists": False}}]}
        )
    )
    logger.debug("Loaded %d active watchlist items", len(items))
    return items


# --------------------------------------------------------------------------- #
# Indicator snapshot helpers
# --------------------------------------------------------------------------- #


def save_indicator_values(
    symbol: str,
    timeframe: str,
    timestamp: datetime,
    indicators: dict[str, Any],
) -> None:
    """Embed the latest indicator snapshot into the matching price document."""
    db = get_db()
    db["prices"].update_one(
        {"symbol": symbol, "timeframe": timeframe, "timestamp": timestamp},
        {"$set": {"indicators": indicators, "updatedAt": datetime.now(timezone.utc)}},
    )
    logger.debug(
        "Saved indicator values for %s/%s at %s",
        symbol,
        timeframe,
        timestamp,
    )


# --------------------------------------------------------------------------- #
# Strategy helpers
# --------------------------------------------------------------------------- #


def sync_strategies(strategy_meta: dict[str, dict[str, Any]]) -> None:
    """Upsert discovered strategies into the ``strategies`` collection.

    Parameters
    ----------
    strategy_meta:
        Dict mapping strategy name -> { name, description, path }.
    """
    db = get_db()
    coll = db["strategies"]

    for name, meta in strategy_meta.items():
        coll.update_one(
            {"name": name},
            {
                "$set": {
                    "name": name,
                    "type": "local",
                    "path": meta.get("path", ""),
                    "description": meta.get("description", ""),
                    "parameters": meta.get("parameters", []),
                    "updatedAt": datetime.now(timezone.utc),
                },
                "$setOnInsert": {
                    "active": True,
                    "registeredAt": datetime.now(timezone.utc),
                },
            },
            upsert=True,
        )

    names = list(strategy_meta.keys())
    logger.info("Synced %d strategies to MongoDB: %s", len(names), names)


def get_strategies(active_only: bool = False) -> list[dict[str, Any]]:
    """Return strategies from the ``strategies`` collection.

    Parameters
    ----------
    active_only:
        If True, only return strategies with ``active: true``.
    """
    db = get_db()
    filt: dict[str, Any] = {}
    if active_only:
        filt["active"] = True
    return list(db["strategies"].find(filt))


# --------------------------------------------------------------------------- #
# Backtest helpers
# --------------------------------------------------------------------------- #


def get_symbols_with_prices() -> list[str]:
    """Return a distinct list of symbols that have price data in MongoDB."""
    db = get_db()
    return sorted(db["prices"].distinct("symbol"))
