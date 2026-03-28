const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema(
  {
    alert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alert",
      index: true,
    },
    signal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Signal",
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    side: {
      type: String,
      required: true,
      enum: ["buy", "sell"],
    },
    quantity: {
      type: Number,
    },
    price: {
      type: Number,
      required: true,
    },
    executedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "executed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    broker: {
      type: String,
      trim: true,
    },
    brokerOrderId: {
      type: String,
    },
    notes: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Trade", tradeSchema);
