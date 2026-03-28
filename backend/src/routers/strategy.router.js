const express = require("express");
const router = express.Router();
const Strategy = require("../models/strategy.model");

/**
 * GET /api/strategies
 * Returns all strategies with optional filtering.
 * Query params:
 *   - active: filter by active status ("true" / "false")
 */
router.get("/", async (req, res) => {
  try {
    const { active } = req.query;
    const filter = {};
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    const data = await Strategy.find(filter).sort({ name: 1 });
    res.json({ data, total: data.length });
  } catch (error) {
    console.error("Error fetching strategies:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/strategies/:name
 * Returns a single strategy by name.
 */
router.get("/:name", async (req, res) => {
  try {
    const strategy = await Strategy.findOne({ name: req.params.name });
    if (!strategy) {
      return res.status(404).json({ error: "Strategy not found" });
    }
    res.json(strategy);
  } catch (error) {
    console.error("Error fetching strategy:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/strategies/:name
 * Toggle active status or update description.
 * Body: { active?: boolean, description?: string }
 */
router.patch("/:name", async (req, res) => {
  try {
    const { active, description } = req.body;
    const update = {};
    if (typeof active === "boolean") update.active = active;
    if (typeof description === "string") update.description = description;

    const strategy = await Strategy.findOneAndUpdate(
      { name: req.params.name },
      { $set: update },
      { new: true }
    );

    if (!strategy) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    res.json(strategy);
  } catch (error) {
    console.error("Error updating strategy:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
