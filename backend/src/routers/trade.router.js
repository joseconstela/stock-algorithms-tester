const express = require("express");
const router = express.Router();
const Trade = require("../models/trade.model");

/**
 * GET /api/trades
 * Returns trades with optional filtering.
 * Query params:
 *   - symbol: filter by ticker symbol
 *   - side: filter by side (buy/sell)
 *   - status: filter by status
 *   - limit: max results (default 50, max 200)
 *   - offset: pagination offset (default 0)
 */
router.get("/", async (req, res) => {
  try {
    const { symbol, side, status, limit = 50, offset = 0 } = req.query;

    const filter = {};
    if (symbol) filter.symbol = symbol.toUpperCase();
    if (side) filter.side = side;
    if (status) filter.status = status;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const [data, total] = await Promise.all([
      Trade.find(filter)
        .populate("alert")
        .populate("signal")
        .sort({ createdAt: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit),
      Trade.countDocuments(filter),
    ]);

    res.json({ data, total, limit: parsedLimit, offset: parsedOffset });
  } catch (error) {
    console.error("Error fetching trades:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/trades/:id
 * Returns a single trade by ID with alert and signal populated.
 */
router.get("/:id", async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id)
      .populate("alert")
      .populate("signal");

    if (!trade) {
      return res.status(404).json({ error: "Trade not found" });
    }

    res.json(trade);
  } catch (error) {
    console.error("Error fetching trade:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
