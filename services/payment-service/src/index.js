require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const paymentRoutes = require("./routes/paymentRoutes");
const verifyInternalKey = require("./middleware/verifyInternalKey");
const app = express();

app.use(express.json());
app.use("/payments", verifyInternalKey, paymentRoutes);

connectDB();

app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  if (dbState !== 1) {
    return res.status(503).json({
      status: "degraded",
      service: "payment-service",
      db: "disconnected",
    });
  }
  res.status(200).json({ status: "ok", service: "payment-service" });
});

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => console.log(`payment-service listening on ${PORT}`));

module.exports = app; // exporting for supertest later
