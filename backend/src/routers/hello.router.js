const express = require("express");
const router = express.Router();

/**
 * GET /api/hello
 * Returns a hello world greeting.
 */
router.get("/", (_req, res) => {
  res.json({ message: "Hello World from strategy_tester API" });
});

module.exports = router;
