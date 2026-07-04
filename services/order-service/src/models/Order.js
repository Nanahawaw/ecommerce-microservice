const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true },
    productId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    orderStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
