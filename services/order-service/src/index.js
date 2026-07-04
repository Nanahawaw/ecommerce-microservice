require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const orderRoutes = require("./routes/orderRoutes");
const correlationId = require("./middleware/correlationId");
const app = express();

app.use(express.json());
app.use(correlationId);
app.use("/orders", orderRoutes);

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

module.exports = app; // exporting for supertest later

// Guarded so requiring this module from a test file doesn't also connect to
// Mongo and bind the real port.
if (require.main === module) {
  connectDB();
  const PORT = process.env.PORT || 4002;
  const server = app.listen(PORT, () =>
    console.log(`order-service listening on ${PORT}`),
  );

  process.on("SIGTERM", () => {
    console.log("[order-service] SIGTERM received, shutting down");
    server.close(() => mongoose.connection.close(false, () => process.exit(0)));
  });
}
