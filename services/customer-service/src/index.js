require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const customerRoutes = require("./routes/customerRoutes");
const verifyInternalKey = require("./middleware/verifyInternalKey");
const correlationId = require("./middleware/correlationId");
const app = express();

app.use(express.json());
app.use(correlationId);
app.use("/customers", verifyInternalKey, customerRoutes);

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

module.exports = app; // exporting for supertest later

// Guarded so requiring this module from a test file doesn't also connect to
// Mongo and bind the real port.
if (require.main === module) {
  connectDB();
  const PORT = process.env.PORT || 4001;
  const server = app.listen(PORT, () =>
    console.log(`customer-service listening on ${PORT}`),
  );

  process.on("SIGTERM", () => {
    console.log("[customer-service] SIGTERM received, shutting down");
    server.close(() => mongoose.connection.close(false, () => process.exit(0)));
  });
}
