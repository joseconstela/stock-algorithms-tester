const express = require("express");
const router = express.Router();
const Watchlist = require("../models/watchlist.model");
const { publishWatchlistAdded } = require("../services/redis");

/**
 * GET /api/watchlist
 * Returns all watchlist items.
 * Query params:
 *   - active: filter by active status ('true' or 'false')
 */
router.get("/", async (req, res) => {
  try {
    const { active } = req.query;

    const filter = {};
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    const data = await Watchlist.find(filter).sort({ createdAt: -1 });

    res.json({ data, total: data.length });
  } catch (error) {
    console.error("Error fetching watchlist:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/watchlist
 * Add a symbol to the watchlist.
 * Body: { symbol, timeframes?, strategies?, alertThreshold?, notes? }
 * Returns 409 if symbol already exists.
 */
router.post("/", async (req, res) => {
  try {
    const { symbol, timeframes, strategies, alertThreshold, signalCooldown, notes } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const upperSymbol = symbol.toUpperCase();

    // Check for duplicate
    const existing = await Watchlist.findOne({ symbol: upperSymbol });
    if (existing) {
      return res.status(409).json({ error: "Symbol already exists in watchlist" });
    }

    const item = await Watchlist.create({
      symbol: upperSymbol,
      timeframes,
      strategies,
      alertThreshold,
      signalCooldown,
      notes,
    });

    // Notify the analysis service so it collects data immediately
    publishWatchlistAdded(item.toObject()).catch((err) => {
      console.error("Failed to publish watchlist:added event:", err.message);
    });

    res.status(201).json(item);
  } catch (error) {
    console.error("Error adding to watchlist:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/watchlist/:symbol
 * Update watchlist item settings.
 * Body: any of { active, timeframes, strategies, alertThreshold, notes }
 */
router.put("/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { active, timeframes, strategies, alertThreshold, signalCooldown, notes } = req.body;

    const update = {};
    if (active !== undefined) update.active = active;
    if (timeframes !== undefined) update.timeframes = timeframes;
    if (strategies !== undefined) update.strategies = strategies;
    if (alertThreshold !== undefined) update.alertThreshold = alertThreshold;
    if (signalCooldown !== undefined) update.signalCooldown = signalCooldown;
    if (notes !== undefined) update.notes = notes;

    const item = await Watchlist.findOneAndUpdate(
      { symbol },
      { $set: update },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ error: "Watchlist item not found" });
    }

    res.json(item);
  } catch (error) {
    console.error("Error updating watchlist item:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/watchlist/:symbol
 * Remove a symbol from the watchlist.
 */
router.delete("/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const item = await Watchlist.findOneAndDelete({ symbol });

    if (!item) {
      return res.status(404).json({ error: "Watchlist item not found" });
    }

    res.json({ message: "Removed from watchlist", symbol });
  } catch (error) {
    console.error("Error removing from watchlist:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
