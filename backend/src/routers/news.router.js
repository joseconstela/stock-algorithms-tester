const express = require("express");
const router = express.Router();
const News = require("../models/news.model");

/**
 * GET /api/news
 * Returns news articles. Supports optional query params:
 *   - ticker: filter by ticker symbol
 *   - limit: max results (default 20, max 100)
 *   - offset: pagination offset (default 0)
 */
router.get("/", async (req, res) => {
  try {
    const { ticker, limit = 20, offset = 0 } = req.query;

    const filter = {};
    if (ticker) {
      filter.tickers = ticker.toUpperCase();
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const [news, total] = await Promise.all([
      News.find(filter)
        .sort({ publishedAt: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit),
      News.countDocuments(filter),
    ]);

    res.json({ data: news, total, limit: parsedLimit, offset: parsedOffset });
  } catch (error) {
    console.error("Error fetching news:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
