require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const app = express();

app.use(express.json());
app.use("/products", productRoutes);

connectDB();

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

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => console.log(`product-service listening on ${PORT}`));

module.exports = app; // exporting for supertest later
