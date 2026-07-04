const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["success", "failed"], required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Payment", paymentSchema);
