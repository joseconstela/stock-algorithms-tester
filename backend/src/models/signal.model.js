const mongoose = require("mongoose");

const signalSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["buy", "sell", "hold"],
    },
    strength: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    timeframe: {
      type: String,
      enum: ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1wk"],
    },
    strategy: {
      type: String,
      trim: true,
      index: true,
    },
    indicators: {
      type: mongoose.Schema.Types.Mixed,
    },
    price: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["active", "expired", "acted"],
      default: "active",
      index: true,
    },
    expiresAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    // Extra fields from pymongo-inserted documents
    timeframe_signals: {
      type: mongoose.Schema.Types.Mixed,
    },
    best_signal: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

module.exports = mongoose.model("Signal", signalSchema);
