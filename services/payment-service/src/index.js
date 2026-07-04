require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const paymentRoutes = require("./routes/paymentRoutes");
const verifyInternalKey = require("./middleware/verifyInternalKey");
const correlationId = require("./middleware/correlationId");
const { connectRabbitMQ } = require("./config/rabbitmq");
const app = express();

app.use(express.json());
app.use(correlationId);
app.use("/payments", verifyInternalKey, paymentRoutes);

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

module.exports = app; // exporting for supertest later

// Guarded so requiring this module from a test file doesn't also connect to
// Mongo/RabbitMQ and bind the real port.
if (require.main === module) {
  connectDB();
  connectRabbitMQ().catch((err) => {
    console.error(
      "[payment-service] failed to connect to RabbitMQ:",
      err.message,
    );
    process.exit(1);
  });

  const PORT = process.env.PORT || 4003;
  const server = app.listen(PORT, () =>
    console.log(`payment-service listening on ${PORT}`),
  );

  process.on("SIGTERM", () => {
    console.log("[payment-service] SIGTERM received, shutting down");
    server.close(() => mongoose.connection.close(false, () => process.exit(0)));
  });
}
