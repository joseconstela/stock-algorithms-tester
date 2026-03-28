const express = require("express");
const router = express.Router();
const BacktestExecution = require("../models/backtestExecution.model");
const BacktestResult = require("../models/backtestResult.model");

const ANALYSIS_HTTP_URL =
  process.env.ANALYSIS_HTTP_URL || "http://localhost:5001";

// =========================================================================
// Execution endpoints
// =========================================================================

/**
 * POST /api/backtest/executions
 * Create a new test execution, then trigger the backtest in the Python service.
 * Body: { symbols: string[], strategies: string[] }
 */
router.post("/executions", async (req, res) => {
  try {
    const { symbols, strategies, strategyParams } = req.body;

    if (!symbols || !symbols.length) {
      return res.status(400).json({ error: "At least one symbol is required" });
    }
    if (!strategies || !strategies.length) {
      return res
        .status(400)
        .json({ error: "At least one strategy is required" });
    }

    // 1. Create the execution record (persist strategyParams for reproducibility)
    const execution = await BacktestExecution.create({
      symbols: symbols.map((s) => s.toUpperCase()),
      strategies,
      strategyParams: strategyParams || {},
      status: "running",
    });

    // 2. Proxy to the Python analysis service (fire & don't wait for full response body)
    //    We pass the executionId so Python can attach results to it.
    try {
      const response = await fetch(`${ANALYSIS_HTTP_URL}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: execution.symbols,
          strategies,
          executionId: execution._id.toString(),
          strategyParams: strategyParams || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        execution.status = "failed";
        execution.error = err.error || "Backtest request failed";
        await execution.save();
        return res.status(response.status).json({ error: execution.error });
      }

      const result = await response.json();

      // Update execution with summary from Python
      execution.status = "completed";
      execution.completedAt = new Date();
      execution.summary = {
        totalResults: result.total ?? 0,
        completed: result.completed ?? 0,
        failed: result.failed ?? 0,
        totalSignals: result.totalSignals ?? 0,
      };
      await execution.save();

      res.json(execution);
    } catch (proxyErr) {
      execution.status = "failed";
      execution.error = "Failed to connect to analysis service";
      await execution.save();
      throw proxyErr;
    }
  } catch (error) {
    console.error("Error creating execution:", error.message);
    res.status(500).json({ error: "Failed to create test execution" });
  }
});

/**
 * GET /api/backtest/executions
 * List all test executions (newest first).
 * Query: limit, offset
 */
router.get("/executions", async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const [data, total] = await Promise.all([
      BacktestExecution.find()
        .sort({ createdAt: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit),
      BacktestExecution.countDocuments(),
    ]);

    res.json({ data, total, limit: parsedLimit, offset: parsedOffset });
  } catch (error) {
    console.error("Error listing executions:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/backtest/executions/:id
 * Get a single execution with its results (without individual signals).
 */
router.get("/executions/:id", async (req, res) => {
  try {
    const execution = await BacktestExecution.findById(req.params.id);
    if (!execution) {
      return res.status(404).json({ error: "Execution not found" });
    }

    const results = await BacktestResult.find({
      executionId: execution._id,
    })
      .select("-signals")
      .sort({ symbol: 1, strategy: 1, timeframe: 1 });

    res.json({ execution, results });
  } catch (error) {
    console.error("Error fetching execution:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/backtest/executions/:id
 * Delete an execution and all its results.
 */
router.delete("/executions/:id", async (req, res) => {
  try {
    const execution = await BacktestExecution.findByIdAndDelete(req.params.id);
    if (!execution) {
      return res.status(404).json({ error: "Execution not found" });
    }
    // Cascade delete all results belonging to this execution
    const deleted = await BacktestResult.deleteMany({
      executionId: execution._id,
    });
    res.json({
      message: "Deleted",
      id: req.params.id,
      resultsDeleted: deleted.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting execution:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =========================================================================
// Result endpoints (individual backtest results within an execution)
// =========================================================================

/**
 * GET /api/backtest/results/:id
 * Get a single backtest result with all signals (for chart rendering).
 */
router.get("/results/:id", async (req, res) => {
  try {
    const result = await BacktestResult.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Backtest result not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("Error fetching backtest result:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =========================================================================
// Utility endpoints
// =========================================================================

/**
 * GET /api/backtest/symbols
 * Returns symbols that have price data (proxies to the Python service).
 */
router.get("/symbols", async (req, res) => {
  try {
    const response = await fetch(`${ANALYSIS_HTTP_URL}/symbols`);
    if (!response.ok) {
      throw new Error(`Analysis service returned ${response.status}`);
    }
    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error("Error fetching symbols:", error.message);
    res.status(500).json({ error: "Failed to connect to analysis service" });
  }
});

module.exports = router;
