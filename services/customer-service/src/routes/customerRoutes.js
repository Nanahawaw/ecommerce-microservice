const express = require("express");
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const router = express.Router();

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      error: { message: "Invalid customer ID format", code: "INVALID_ID" },
    });
  }

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({
        error: { message: "Customer not found", code: "CUSTOMER_NOT_FOUND" },
      });
    }
    return res.status(200).json({ data: customer });
  } catch (err) {
    console.error("[customer-service] GET /:id failed:", err.message);
    return res.status(500).json({
      error: { message: "Internal server error", code: "INTERNAL_ERROR" },
    });
  }
});

module.exports = router;
