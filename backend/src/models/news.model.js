const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
    },
    tickers: [
      {
        type: String,
        uppercase: true,
        trim: true,
      },
    ],
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("News", newsSchema);
