const mongoose = require("mongoose");

const watchlistSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    timeframes: {
      type: [String],
      default: ["15m", "1h", "1d"],
    },
    strategies: {
      type: [String],
      default: ["ma_crossover", "rsi_reversal", "macd_crossover"],
    },
    alertThreshold: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },
    signalCooldown: {
      type: Number,
      min: 1,
      max: 1440,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Watchlist", watchlistSchema);
