const express = require("express");
const router = express.Router();
const Signal = require("../models/signal.model");

/**
 * GET /api/signals/active
 * Returns all active signals (status === 'active').
 * Defined before /:id to avoid route conflicts.
 */
router.get("/active", async (req, res) => {
  try {
    const data = await Signal.find({ status: "active" }).sort({
      createdAt: -1,
    });

    res.json({ data, total: data.length });
  } catch (error) {
    console.error("Error fetching active signals:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/signals
 * Returns signals with optional filtering.
 * Query params:
 *   - symbol: filter by ticker symbol
 *   - type: filter by type (buy/sell/hold)
 *   - status: filter by status (active/expired/acted)
 *   - strategy: filter by strategy name
 *   - timeframe: filter by timeframe
 *   - limit: max results (default 50, max 200)
 *   - offset: pagination offset (default 0)
 */
router.get("/", async (req, res) => {
  try {
    const {
      symbol,
      type,
      status,
      strategy,
      timeframe,
      limit = 50,
      offset = 0,
    } = req.query;

    const filter = {};
    if (symbol) filter.symbol = symbol.toUpperCase();
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (strategy) filter.strategy = strategy;
    if (timeframe) filter.timeframe = timeframe;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const [data, total] = await Promise.all([
      Signal.find(filter)
        .sort({ createdAt: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit),
      Signal.countDocuments(filter),
    ]);

    res.json({ data, total, limit: parsedLimit, offset: parsedOffset });
  } catch (error) {
    console.error("Error fetching signals:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/signals/:id
 * Returns a single signal by ID.
 */
router.get("/:id", async (req, res) => {
  try {
    const signal = await Signal.findById(req.params.id);

    if (!signal) {
      return res.status(404).json({ error: "Signal not found" });
    }

    res.json(signal);
  } catch (error) {
    console.error("Error fetching signal:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
