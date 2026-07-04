const express = require("express");
const Payment = require("../models/Payment");
const { getChannel, EXCHANGE, ROUTING_KEY } = require("../config/rabbitmq");
const router = express.Router();

router.post("/", async (req, res) => {
  const { customerId, orderId, productId, amount } = req.body;

  if (!customerId || !orderId || !productId || amount === undefined) {
    return res.status(400).json({
      error: {
        message: "customerId, orderId, productId and amount are required",
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
    try {
      const channel = getChannel();
      const message = Buffer.from(
        JSON.stringify({
          customerId,
          orderId,
          productId,
          amount,
          correlationId: req.correlationId,
        }),
      );
      const published = channel.publish(
        EXCHANGE,
        ROUTING_KEY,
        message,
        { persistent: true },
        (err, ok) => {
          if (err)
            console.error(
              "[payment-service] publish confirm failed:",
              err.message,
            );
        },
      );
      if (!published) {
        console.warn(
          "[payment-service] channel write buffer full, message may be delayed",
        );
      }
    } catch (err) {
      // deliberately NOT failing the payment response over a publish error — see rationale below
      console.error(
        "[payment-service] failed to publish transaction message:",
        err.message,
      );
    }
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

  return res
    .status(200)
    .json({ data: { orderId: payment.orderId, status: payment.status } });
});
module.exports = router;
