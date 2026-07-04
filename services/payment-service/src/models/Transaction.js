const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true },
    orderId: { type: String, required: true, unique: true },
    productId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Transaction", transactionSchema);
