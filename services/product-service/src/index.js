require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "product-service" });
});

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => console.log(`product-service listening on ${PORT}`));

module.exports = app; // exporting for supertest later
