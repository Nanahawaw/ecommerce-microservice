const express = require("express");
const Payment = require("../models/Payment");
const router = express.Router();

router.post("/", async (req, res) => {
  const { customerId, orderId, amount } = req.body;

  if (!customerId || !orderId || amount === undefined) {
    return res.status(400).json({
      error: {
        message: "customerId, orderId and amount are required",
        code: "MISSING_FIELDS",
      },
    });
  }

  const existing = await Payment.findOne({ orderId });
  if (existing) {
    return res.status(200).json({
      data: {
        orderId: existing.orderId,
        status: existing.status,
      },
    });
  }
  const failureRate = parseFloat(process.env.PAYMENT_FAILURE_RATE || "0.1");
  const isSuccess = Math.random() >= failureRate;
  const status = isSuccess ? "success" : "failed";

  let payment;
  try {
    payment = await Payment.create({ orderId, customerId, amount, status });
  } catch (err) {
    if (err.code === 11000) {
      const raceWinner = await Payment.findOne({ orderId });
      return res.status(200).json({
        data: {
          orderId: raceWinner.orderId,
          status: raceWinner.status,
        },
      });
    }
    console.error(
      "[payment-service] failed to create payment record:",
      err.message,
    );
    return res.status(500).json({
      error: {
        message: "Failed to process payment",
        code: "PAYMENT_PROCESSING_FAILED",
      },
    });
  }
  //publish to RabbitMQ

  return res
    .status(200)
    .json({ data: { orderId: payment.orderId, status: payment.status } });
});
module.exports = router;
