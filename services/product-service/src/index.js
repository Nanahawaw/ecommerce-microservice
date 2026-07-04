require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const verifyInternalKey = require("./middleware/verifyInternalKey");
const correlationId = require("./middleware/correlationId");
const app = express();

app.use(express.json());
app.use(correlationId);
app.use("/products", verifyInternalKey, productRoutes);

app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState !== 1) {
    return res.status(503).json({
      status: "degraded",
      service: "product-service",
      db: "disconnected",
    });
  }
  res.status(200).json({ status: "ok", service: "product-service" });
});

module.exports = app; // exporting for supertest later

// Guarded so requiring this module from a test file doesn't also connect to
// Mongo and bind the real port.
if (require.main === module) {
  connectDB();
  const PORT = process.env.PORT || 4004;
  const server = app.listen(PORT, () =>
    console.log(`product-service listening on ${PORT}`),
  );

  process.on("SIGTERM", () => {
    console.log("[product-service] SIGTERM received, shutting down");
    server.close(() => mongoose.connection.close(false, () => process.exit(0)));
  });
}
