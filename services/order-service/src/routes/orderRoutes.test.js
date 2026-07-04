process.env.MONGO_URI = "mongodb://unused/test";
process.env.CUSTOMER_SERVICE_URL = "http://customer-service:4001";
process.env.PRODUCT_SERVICE_URL = "http://product-service:4004";
process.env.PAYMENT_SERVICE_URL = "http://payment-service:4003";

jest.mock("../config/db", () => jest.fn());
jest.mock("../models/Order");
jest.mock("../utils/httpClient");
jest.mock("../utils/paymentBreaker", () => ({ fire: jest.fn() }));

const request = require("supertest");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { callService } = require("../utils/httpClient");
const paymentBreaker = require("../utils/paymentBreaker");
const app = require("../index");

const customerId = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();

afterEach(() => jest.clearAllMocks());

describe("POST /orders — validation", () => {
  it("400s when customerId/productId are missing", async () => {
    const res = await request(app).post("/orders").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_FIELDS");
  });

  it("400s on malformed ids", async () => {
    const res = await request(app)
      .post("/orders")
      .send({ customerId: "not-an-id", productId: "also-not-an-id" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ID");
  });
});

describe("POST /orders — upstream lookups", () => {
  it("400s when the customer doesn't exist", async () => {
    callService.mockResolvedValueOnce({ ok: false, status: 404, body: null });
    const res = await request(app).post("/orders").send({ customerId, productId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it("502s when customer-service is unreachable", async () => {
    callService.mockResolvedValueOnce({ ok: false, status: null, body: null });
    const res = await request(app).post("/orders").send({ customerId, productId });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("CUSTOMER_SERVICE_UNAVAILABLE");
  });

  it("400s when the product doesn't exist", async () => {
    callService
      .mockResolvedValueOnce({ ok: true, status: 200, body: { data: {} } }) // customer found
      .mockResolvedValueOnce({ ok: false, status: 404, body: null }); // product missing
    const res = await request(app).post("/orders").send({ customerId, productId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });
});

describe("POST /orders — happy path and payment outcomes", () => {
  function mockUpstreamsOk(price = 25.99) {
    callService
      .mockResolvedValueOnce({ ok: true, status: 200, body: { data: {} } })
      .mockResolvedValueOnce({ ok: true, status: 200, body: { data: { price } } });
  }

  function mockOrderDoc() {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      customerId,
      productId,
      amount: 25.99,
      orderStatus: "pending",
      save: jest.fn().mockResolvedValue(true),
    };
    Order.create.mockResolvedValue(doc);
    return doc;
  }

  it("creates a completed order when payment succeeds, and uses the product-service price (not client input)", async () => {
    mockUpstreamsOk(25.99);
    const orderDoc = mockOrderDoc();
    paymentBreaker.fire.mockResolvedValue({
      ok: true,
      body: { data: { status: "success" } },
    });

    const res = await request(app)
      .post("/orders")
      .send({ customerId, productId, amount: 999999 }); // client-supplied amount must be ignored

    expect(res.status).toBe(201);
    expect(res.body.data.orderStatus).toBe("completed");
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 25.99 }),
    );
    expect(orderDoc.save).toHaveBeenCalled();
  });

  it("marks the order failed when payment-service reports failure", async () => {
    mockUpstreamsOk();
    mockOrderDoc();
    paymentBreaker.fire.mockResolvedValue({
      ok: true,
      body: { data: { status: "failed" } },
    });

    const res = await request(app).post("/orders").send({ customerId, productId });
    expect(res.status).toBe(201);
    expect(res.body.data.orderStatus).toBe("failed");
  });

  it("marks the order failed when the payment circuit is open", async () => {
    mockUpstreamsOk();
    mockOrderDoc();
    paymentBreaker.fire.mockResolvedValue({
      ok: false,
      status: null,
      body: null,
      circuitOpen: true,
    });

    const res = await request(app).post("/orders").send({ customerId, productId });
    expect(res.status).toBe(201);
    expect(res.body.data.orderStatus).toBe("failed");
  });

  it("returns the shape the customer response is required to have", async () => {
    mockUpstreamsOk();
    const orderDoc = mockOrderDoc();
    paymentBreaker.fire.mockResolvedValue({
      ok: true,
      body: { data: { status: "success" } },
    });

    const res = await request(app).post("/orders").send({ customerId, productId });
    expect(res.body.data).toEqual({
      customerId: orderDoc.customerId,
      orderId: orderDoc._id.toString(), // res.body is JSON — ObjectId serializes to its hex string
      productId: orderDoc.productId,
      orderStatus: "completed",
    });
  });
});
