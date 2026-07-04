require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const app = express();

app.use(express.json());

connectDB();

app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState !== 1) {
    return res.status(503).json({
      status: "degraded",
      service: "order-service",
      db: "disconnected",
    });
  }
  res.status(200).json({ status: "ok", service: "order-service" });
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`order-service listening on ${PORT}`));

module.exports = app; // exporting for supertest later
