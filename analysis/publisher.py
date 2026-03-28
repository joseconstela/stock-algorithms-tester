"""
Redis publisher module.

Publishes analysis signals and price updates to Redis Pub/Sub channels
so the Node.js backend can forward them to connected frontends via
Socket.IO.

Channel naming conventions:
- ``signals:{symbol}`` – buy/sell/hold signals
- ``prices:{symbol}``  – latest price snapshots
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import redis as redis_lib

from config import REDIS_URL

logger = logging.getLogger(__name__)

# Module-level singleton
_redis: redis_lib.Redis | None = None


def get_redis() -> redis_lib.Redis:
    """Return the shared Redis connection (singleton).

    The connection is established on first call and reused afterwards.
    """
    global _redis
    if _redis is None:
        logger.info("Connecting to Redis at %s", REDIS_URL)
        _redis = redis_lib.from_url(REDIS_URL, decode_responses=True)
        # Verify connectivity
        _redis.ping()
        logger.info("Redis connection established")
    return _redis


def _serialise(obj: Any) -> str:
    """JSON-serialise *obj*, handling datetime and BSON types."""

    def _default(o: Any) -> str:
        if isinstance(o, datetime):
            return o.isoformat()
        # Handle bson.ObjectId from pymongo
        if hasattr(o, "__str__") and type(o).__name__ == "ObjectId":
            return str(o)
        raise TypeError(f"Object of type {type(o)} is not JSON serializable")

    return json.dumps(obj, default=_default)


def publish_signal(signal_dict: dict[str, Any]) -> int:
    """Publish a signal to the ``signals:{symbol}`` channel.

    Parameters
    ----------
    signal_dict:
        Must contain at least a ``symbol`` key.

    Returns
    -------
    int
        Number of subscribers that received the message.
    """
    symbol = signal_dict.get("symbol", "unknown")
    channel = f"signals:{symbol}"

    try:
        r = get_redis()
        payload = _serialise(signal_dict)
        receivers = r.publish(channel, payload)
        logger.info(
            "Published signal to %s (%d subscribers): %s %s strength=%s",
            channel,
            receivers,
            signal_dict.get("type", "?"),
            symbol,
            signal_dict.get("strength", "?"),
        )
        return receivers
    except Exception:
        logger.exception("Failed to publish signal to %s", channel)
        return 0


def subscribe_watchlist_added(callback) -> None:
    """Subscribe to the ``watchlist:added`` channel.

    Spawns a blocking listener on the shared Redis connection's pubsub.
    *callback* is called with the parsed JSON dict for every message.

    This is intended to be run in a daemon thread.
    """
    r = get_redis()
    ps = r.pubsub()
    ps.subscribe("watchlist:added")
    logger.info("Subscribed to watchlist:added channel")

    for message in ps.listen():
        if message["type"] != "message":
            continue
        try:
            data = json.loads(message["data"])
            callback(data)
        except Exception:
            logger.exception("Error handling watchlist:added message")


def publish_price_update(symbol: str, price_data: dict[str, Any]) -> int:
    """Publish a price update to the ``prices:{symbol}`` channel.

    Parameters
    ----------
    symbol:
        Ticker symbol.
    price_data:
        Arbitrary dict of price information (OHLCV, indicators, etc.).

    Returns
    -------
    int
        Number of subscribers that received the message.
    """
    channel = f"prices:{symbol}"
    price_data.setdefault("symbol", symbol)
    price_data.setdefault("timestamp", datetime.now(timezone.utc).isoformat())

    try:
        r = get_redis()
        payload = _serialise(price_data)
        receivers = r.publish(channel, payload)
        logger.debug(
            "Published price update to %s (%d subscribers)", channel, receivers
        )
        return receivers
    except Exception:
        logger.exception("Failed to publish price update to %s", channel)
        return 0
