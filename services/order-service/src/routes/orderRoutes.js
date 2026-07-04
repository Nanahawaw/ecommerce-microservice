const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const callService = require("../utils/httpClient");
const router = express.Router();

router.post("/", async (req, res) => {
  const { customerId, productId } = req.body;

  if (!customerId || !productId) {
    return res.status(400).json({
      error: {
        message: "customerId and productId are required",
        code: "MISSING_FIELDS",
      },
    });
  }

  if (
    !mongoose.Types.ObjectId.isValid(customerId) ||
    !mongoose.Types.ObjectId.isValid(productId)
  ) {
    return res.status(400).json({
      error: {
        message: "customerId or productId is not a valid ID",
        code: "INVALID_ID",
      },
    });
  }

  // 1. Validate customer exists
  const customerResult = await callService({
    url: `${process.env.CUSTOMER_SERVICE_URL}/customers/${customerId}`,
    apiKey: process.env.CUSTOMER_SERVICE_API_KEY,
  });
  if (!customerResult.ok) {
    if (customerResult.status === 404) {
      return res.status(400).json({
        error: { message: "Customer not found", code: "CUSTOMER_NOT_FOUND" },
      });
    }
    return res.status(502).json({
      error: {
        message: "Unable to verify customer",
        code: "CUSTOMER_SERVICE_UNAVAILABLE",
      },
    });
  }

  // 2. Validate product exists and get its real price
  const productResult = await callService({
    url: `${process.env.PRODUCT_SERVICE_URL}/products/${productId}`,
    apiKey: process.env.PRODUCT_SERVICE_API_KEY,
  });
  if (!productResult.ok) {
    if (productResult.status === 404) {
      return res.status(400).json({
        error: { message: "Product not found", code: "PRODUCT_NOT_FOUND" },
      });
    }
    return res.status(502).json({
      error: {
        message: "Unable to verify product",
        code: "PRODUCT_SERVICE_UNAVAILABLE",
      },
    });
  }
  const amount = productResult.body.data.price;

  let order;
  try {
    order = await Order.create({
      customerId,
      productId,
      amount,
      orderStatus: "pending",
    });
  } catch (err) {
    console.error(
      "[order-service] failed to create pending order:",
      err.message,
    );
    return res.status(500).json({
      error: {
        message: "Failed to create order",
        code: "ORDER_CREATE_FAILED",
      },
    });
  }
  //call payment service to process payment

  const paymentResult = await callService({
    url: `${process.env.PAYMENT_SERVICE_URL}/payments`,
    method: "POST",
    data: { customerId, orderId: order._id.toString(), amount },
    apiKey: process.env.PAYMENT_SERVICE_API_KEY,
  });

  if (paymentResult.ok && paymentResult.body.data.status === "success") {
    order.orderStatus = "completed";
  } else {
    order.orderStatus = "failed";
  }
  //save order
  await order.save();
  return res.status(201).json({
    data: {
      customerId: order.customerId,
      orderId: order._id,
      productId: order.productId,
      orderStatus: order.orderStatus,
    },
  });
});
module.exports = router;
