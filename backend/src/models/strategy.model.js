const mongoose = require("mongoose");

const strategySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["local"],
      default: "local",
    },
    path: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    active: {
      type: Boolean,
      default: true,
    },
    parameters: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    registeredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Strategy", strategySchema);
