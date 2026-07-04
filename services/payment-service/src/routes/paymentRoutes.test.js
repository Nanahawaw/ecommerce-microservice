process.env.INTERNAL_API_KEY = "test-internal-key";
process.env.MONGO_URI = "mongodb://unused/test";
process.env.RABBITMQ_URL = "amqp://unused";

jest.mock("../config/db", () => jest.fn());
jest.mock("../config/rabbitmq", () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue({}),
  getChannel: jest.fn(),
  EXCHANGE: "payments.exchange",
  ROUTING_KEY: "transaction.created",
}));
jest.mock("../models/Payment");

const request = require("supertest");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const { getChannel } = require("../config/rabbitmq");
const app = require("../index");

const headers = { "x-internal-api-key": process.env.INTERNAL_API_KEY };
const customerId = new mongoose.Types.ObjectId().toString();
const orderId = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();

let channel;

beforeEach(() => {
  channel = { publish: jest.fn().mockReturnValue(true) };
  getChannel.mockReturnValue(channel);
});
afterEach(() => jest.clearAllMocks());

describe("auth", () => {
  it("401s when the internal api key is missing", async () => {
    const res = await request(app).post("/payments").send({});
    expect(res.status).toBe(401);
  });
});

describe("POST /payments — validation", () => {
  it("400s when required fields are missing", async () => {
    const res = await request(app)
      .post("/payments")
      .set(headers)
      .send({ customerId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_FIELDS");
  });
});

describe("POST /payments — idempotency", () => {
  it("returns the existing result for an orderId that's already been processed, without re-creating it", async () => {
    Payment.findOne.mockResolvedValue({ orderId, status: "success" });

    const res = await request(app)
      .post("/payments")
      .set(headers)
      .send({ customerId, orderId, productId, amount: 25.99 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ orderId, status: "success" });
    expect(Payment.create).not.toHaveBeenCalled();
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it("resolves to the race winner's status on a duplicate-key error from a concurrent request", async () => {
    Payment.findOne
      .mockResolvedValueOnce(null) // pre-check finds nothing
      .mockResolvedValueOnce({ orderId, status: "failed" }); // re-lookup after the race
    const dupKeyError = new Error("E11000 duplicate key");
    dupKeyError.code = 11000;
    Payment.create.mockRejectedValue(dupKeyError);

    const res = await request(app)
      .post("/payments")
      .set(headers)
      .send({ customerId, orderId, productId, amount: 25.99 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ orderId, status: "failed" });
  });
});

describe("POST /payments — happy path", () => {
  it("creates the payment record and publishes the transaction to RabbitMQ", async () => {
    Payment.findOne.mockResolvedValue(null);
    Payment.create.mockResolvedValue({ orderId, status: "success" });

    const res = await request(app)
      .post("/payments")
      .set(headers)
      .send({ customerId, orderId, productId, amount: 25.99 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ orderId, status: "success" });
    expect(channel.publish).toHaveBeenCalledTimes(1);

    const [exchange, routingKey, message] = channel.publish.mock.calls[0];
    expect(exchange).toBe("payments.exchange");
    expect(routingKey).toBe("transaction.created");
    expect(JSON.parse(message.toString())).toMatchObject({
      customerId,
      orderId,
      productId,
      amount: 25.99,
    });
  });

  it("still returns 200 to the caller if the RabbitMQ publish itself throws", async () => {
    Payment.findOne.mockResolvedValue(null);
    Payment.create.mockResolvedValue({ orderId, status: "success" });
    getChannel.mockImplementation(() => {
      throw new Error("channel not initialized");
    });

    const res = await request(app)
      .post("/payments")
      .set(headers)
      .send({ customerId, orderId, productId, amount: 25.99 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ orderId, status: "success" });
  });

  it("500s when persisting the payment fails for a reason other than a duplicate key", async () => {
    Payment.findOne.mockResolvedValue(null);
    Payment.create.mockRejectedValue(new Error("mongo is down"));

    const res = await request(app)
      .post("/payments")
      .set(headers)
      .send({ customerId, orderId, productId, amount: 25.99 });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("PAYMENT_PROCESSING_FAILED");
  });
});
