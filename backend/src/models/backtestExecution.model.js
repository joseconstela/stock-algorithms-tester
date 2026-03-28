const mongoose = require("mongoose");

const backtestExecutionSchema = new mongoose.Schema(
  {
    symbols: {
      type: [String],
      required: true,
    },
    strategies: {
      type: [String],
      required: true,
    },
    strategyParams: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true,
    },
    summary: {
      totalResults: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      totalSignals: { type: Number, default: 0 },
    },
    error: String,
    completedAt: Date,
  },
  {
    timestamps: true,
    collection: "backtest_executions",
  }
);

module.exports = mongoose.model("BacktestExecution", backtestExecutionSchema);
