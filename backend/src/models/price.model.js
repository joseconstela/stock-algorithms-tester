const mongoose = require("mongoose");

const priceSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    timeframe: {
      type: String,
      required: true,
      enum: ["1m", "5m", "15m", "1h", "4h", "1d", "1w"],
      index: true,
    },
    open: {
      type: Number,
      required: true,
    },
    high: {
      type: Number,
      required: true,
    },
    low: {
      type: Number,
      required: true,
    },
    close: {
      type: Number,
      required: true,
    },
    volume: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    indicators: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate candles for the same symbol/timeframe/timestamp
priceSchema.index({ symbol: 1, timeframe: 1, timestamp: 1 }, { unique: true });

// Efficient queries for latest candles by symbol and timeframe
priceSchema.index({ symbol: 1, timeframe: 1, timestamp: -1 });

module.exports = mongoose.model("Price", priceSchema);
