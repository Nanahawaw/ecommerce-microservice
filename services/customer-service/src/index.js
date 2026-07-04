require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const customerRoutes = require("./routes/customerRoutes");
const verifyInternalKey = require("./middleware/verifyInternalKey");
const app = express();

app.use(express.json());
app.use("/customers", verifyInternalKey, customerRoutes);

connectDB();

app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  if (dbState !== 1) {
    return res.status(503).json({
      status: "degraded",
      service: "customer-service",
      db: "disconnected",
    });
  }
  res.status(200).json({ status: "ok", service: "customer-service" });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`customer-service listening on ${PORT}`));

module.exports = app; // exporting for supertest later
