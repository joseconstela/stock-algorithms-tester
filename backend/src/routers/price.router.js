const express = require("express");
const router = express.Router();
const Price = require("../models/price.model");

const VALID_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "1d", "1wk"];

/**
 * GET /api/prices/:symbol
 * Returns price candles for a symbol.
 * Query params:
 *   - timeframe: candle timeframe (default '1h')
 *   - limit: max results (default 200, max 1000)
 *   - from: start date (ISO string)
 *   - to: end date (ISO string)
 */
router.get("/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { timeframe = "1h", limit = 200, from, to } = req.query;

    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return res
        .status(400)
        .json({ error: `Invalid timeframe. Must be one of: ${VALID_TIMEFRAMES.join(", ")}` });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);

    const filter = { symbol, timeframe };

    // Apply date range filters if provided
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      Price.find(filter)
        .sort({ timestamp: -1 })
        .limit(parsedLimit),
      Price.countDocuments(filter),
    ]);

    res.json({ data, total, symbol, timeframe });
  } catch (error) {
    console.error("Error fetching prices:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/prices/:symbol/latest
 * Returns the latest candle for each timeframe for a given symbol.
 */
router.get("/:symbol/latest", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const pipeline = [
      { $match: { symbol } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$timeframe",
          latest: { $first: "$$ROOT" },
        },
      },
    ];

    const results = await Price.aggregate(pipeline);

    // Build an object keyed by timeframe
    const data = {};
    for (const result of results) {
      data[result._id] = result.latest;
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching latest prices:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
