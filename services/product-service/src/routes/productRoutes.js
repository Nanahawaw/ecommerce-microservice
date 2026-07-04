const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const router = express.Router();

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      error: { message: "Invalid product ID format", code: "INVALID_ID" },
    });
  }

  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        error: { message: "Product not found", code: "PRODUCT_NOT_FOUND" },
      });
    }
    return res.status(200).json({ data: product });
  } catch (err) {
    console.error("[product-service] GET /:id failed:", err.message);
    return res.status(500).json({
      error: { message: "Internal server error", code: "INTERNAL_ERROR" },
    });
  }
});

module.exports = router;
