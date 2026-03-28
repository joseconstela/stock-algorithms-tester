const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6380";

// Shared connection options: limit retries and reduce log noise
const redisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    // Exponential backoff capped at 30 seconds
    const delay = Math.min(times * 500, 30000);
    return delay;
  },
  lazyConnect: false,
};

// Publisher client - used for publishing messages to channels
const publisher = new Redis(REDIS_URL, redisOptions);

// Subscriber client - dedicated connection for subscriptions
// (Redis requires separate connections for pub/sub)
const subscriber = new Redis(REDIS_URL, redisOptions);

// Connection event logging - publisher
publisher.on("connect", () => {
  console.log("Redis publisher connected");
});
publisher.on("error", (err) => {
  // Log only once per error cycle to avoid spam
  if (err.code !== "ECONNREFUSED" || !publisher._lastRefusedLog ||
      Date.now() - publisher._lastRefusedLog > 30000) {
    console.error("Redis publisher error:", err.message);
    if (err.code === "ECONNREFUSED") publisher._lastRefusedLog = Date.now();
  }
});

// Connection event logging - subscriber
subscriber.on("connect", () => {
  console.log("Redis subscriber connected");
});
subscriber.on("error", (err) => {
  if (err.code !== "ECONNREFUSED" || !subscriber._lastRefusedLog ||
      Date.now() - subscriber._lastRefusedLog > 30000) {
    console.error("Redis subscriber error:", err.message);
    if (err.code === "ECONNREFUSED") subscriber._lastRefusedLog = Date.now();
  }
});

/**
 * Publish a new signal to the symbol-specific channel.
 * @param {Object} signal - The signal object (must include a `symbol` field)
 */
const publishSignal = async (signal) => {
  const channel = `signals:${signal.symbol}`;
  await publisher.publish(channel, JSON.stringify(signal));
};

/**
 * Publish a price update to the symbol-specific channel.
 * @param {string} symbol - Ticker symbol
 * @param {Object} data - Price / OHLCV data
 */
const publishPriceUpdate = async (symbol, data) => {
  const channel = `prices:${symbol}`;
  await publisher.publish(channel, JSON.stringify(data));
};

/**
 * Subscribe to all signal channels using pattern matching.
 * @param {Function} callback - Called with (channel, message) on each message
 */
const subscribeToSignals = (callback) => {
  subscriber.psubscribe("signals:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    if (pattern === "signals:*") {
      callback(channel, JSON.parse(message));
    }
  });
};

/**
 * Subscribe to all price channels using pattern matching.
 * @param {Function} callback - Called with (channel, message) on each message
 */
const subscribeToPrices = (callback) => {
  subscriber.psubscribe("prices:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    if (pattern === "prices:*") {
      callback(channel, JSON.parse(message));
    }
  });
};

/**
 * Publish a watchlist addition event so the analysis service can
 * immediately start collecting data for the new symbol.
 * @param {Object} item - The watchlist document (must include `symbol`)
 */
const publishWatchlistAdded = async (item) => {
  const channel = "watchlist:added";
  await publisher.publish(channel, JSON.stringify(item));
};

module.exports = {
  publisher,
  subscriber,
  publishSignal,
  publishPriceUpdate,
  publishWatchlistAdded,
  subscribeToSignals,
  subscribeToPrices,
};
