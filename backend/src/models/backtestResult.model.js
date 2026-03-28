const mongoose = require("mongoose");

const backtestSignalSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["buy", "sell"],
    },
    strength: Number,
    timestamp: Date,
    price: Number,
    indicators: mongoose.Schema.Types.Mixed,
    reason: String,
  },
  { _id: false }
);

const backtestResultSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    strategy: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    timeframe: {
      type: String,
      required: true,
      enum: ["1m", "5m", "15m", "30m", "1h", "1d", "1wk"],
    },
    signals: [backtestSignalSchema],
    summary: {
      totalSignals: Number,
      buySignals: Number,
      sellSignals: Number,
      avgStrength: Number,
      dateRange: {
        from: Date,
        to: Date,
      },
      totalCandles: Number,
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true,
    },
    error: String,
    executionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BacktestExecution",
      index: true,
    },
    batchId: {
      type: String,
      index: true,
    },
    completedAt: Date,
  },
  {
    timestamps: true,
    strict: false,
    collection: "backtest_results",
  }
);

module.exports = mongoose.model("BacktestResult", backtestResultSchema);
