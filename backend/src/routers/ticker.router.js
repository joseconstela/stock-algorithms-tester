const express = require("express");
const router = express.Router();
const Ticker = require("../models/ticker.model");

/**
 * GET /api/ticker/:ticker
 * Returns a single ticker by symbol.
 */
router.get("/:ticker", async (req, res) => {
  try {
    const symbol = req.params.ticker.toUpperCase();
    const ticker = await Ticker.findOne({ symbol });

    if (!ticker) {
      return res.status(404).json({ error: "Ticker not found" });
    }

    res.json(ticker);
  } catch (error) {
    console.error("Error fetching ticker:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
