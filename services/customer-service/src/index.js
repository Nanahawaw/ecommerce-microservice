require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "customer-service" });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`customer-service listening on ${PORT}`));

module.exports = app; // exporting for supertest later
