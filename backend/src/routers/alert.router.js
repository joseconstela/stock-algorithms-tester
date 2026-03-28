const express = require("express");
const router = express.Router();
const Alert = require("../models/alert.model");
const Trade = require("../models/trade.model");

/**
 * GET /api/alerts/pending
 * Returns all pending alerts (status === 'pending').
 * Defined before /:id to avoid route conflicts.
 */
router.get("/pending", async (req, res) => {
  try {
    const data = await Alert.find({ status: "pending" })
      .populate("signal")
      .sort({ createdAt: -1 });

    res.json({ data, total: data.length });
  } catch (error) {
    console.error("Error fetching pending alerts:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/alerts
 * Returns alerts with optional filtering.
 * Query params:
 *   - symbol: filter by ticker symbol
 *   - status: filter by status (pending/approved/rejected/expired)
 *   - limit: max results (default 50, max 200)
 *   - offset: pagination offset (default 0)
 */
router.get("/", async (req, res) => {
  try {
    const { symbol, status, limit = 50, offset = 0 } = req.query;

    const filter = {};
    if (symbol) filter.symbol = symbol.toUpperCase();
    if (status) filter.status = status;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const [data, total] = await Promise.all([
      Alert.find(filter)
        .populate("signal")
        .sort({ createdAt: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit),
      Alert.countDocuments(filter),
    ]);

    res.json({ data, total, limit: parsedLimit, offset: parsedOffset });
  } catch (error) {
    console.error("Error fetching alerts:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/alerts/:id
 * Returns a single alert by ID with its signal populated.
 */
router.get("/:id", async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id).populate("signal");

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json(alert);
  } catch (error) {
    console.error("Error fetching alert:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/alerts/:id/respond
 * Approve or reject an alert.
 * Body: { action: 'approve' | 'reject' }
 * If approved, creates a Trade record with status 'pending'.
 * Emits Socket.IO events: alert:responded, and optionally trade:executed.
 */
router.post("/:id/respond", async (req, res) => {
  try {
    const { action } = req.body;

    if (!action || !["approve", "reject"].includes(action)) {
      return res
        .status(400)
        .json({ error: "Invalid action. Must be 'approve' or 'reject'" });
    }

    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    if (alert.status !== "pending") {
      return res
        .status(409)
        .json({ error: `Alert has already been ${alert.status}` });
    }

    // Check if alert has expired
    if (alert.expiresAt && new Date(alert.expiresAt) < new Date()) {
      alert.status = "expired";
      await alert.save();
      return res.status(410).json({ error: "Alert has expired" });
    }

    // Update alert status
    alert.status = action === "approve" ? "approved" : "rejected";
    alert.respondedAt = new Date();
    await alert.save();

    const io = req.app.get("io");

    // Emit alert responded event
    if (io) {
      io.emit("alert:responded", alert);
    }

    // If approved, create a pending trade
    let trade = null;
    if (action === "approve") {
      trade = await Trade.create({
        alert: alert._id,
        signal: alert.signal,
        symbol: alert.symbol,
        side: alert.type === "buy" ? "buy" : "sell",
        quantity: 0,
        price: alert.price,
        status: "pending",
      });

      if (io) {
        io.emit("trade:executed", trade);
      }
    }

    res.json({ alert, trade });
  } catch (error) {
    console.error("Error responding to alert:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
