const mongoose = require("mongoose");

let dbReady = false;

const connectDB = async () => {
  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27018/strategy_tester";
  const maxRetries = 10;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri);
      dbReady = true;
      console.log("MongoDB connected successfully");
      return;
    } catch (error) {
      console.error(
        `MongoDB connection attempt ${attempt}/${maxRetries} failed: ${error.message}`,
      );
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
  }
  console.error("MongoDB connection failed after all retries – exiting");
  process.exit(1);
};

const isDbReady = () => dbReady;

module.exports = connectDB;
module.exports.isDbReady = isDbReady;
