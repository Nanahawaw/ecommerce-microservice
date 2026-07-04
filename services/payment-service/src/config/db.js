const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      "MONGO_URI is required — refusing to start without a database target",
    );
  }

  try {
    await mongoose.connect(uri);
    console.log(`[db] connected: ${uri}`);
  } catch (err) {
    console.error("[db] connection failed:", err.message);
    process.exit(1); // fail fast — a service with no DB should not pretend to be healthy
  }
}

module.exports = connectDB;
