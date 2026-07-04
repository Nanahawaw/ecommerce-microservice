process.env.INTERNAL_API_KEY = "test-internal-key";
process.env.MONGO_URI = "mongodb://unused/test";

jest.mock("../config/db", () => jest.fn());
jest.mock("../models/Customer");

const request = require("supertest");
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const app = require("../index");

const headers = { "x-internal-api-key": process.env.INTERNAL_API_KEY };
const validId = new mongoose.Types.ObjectId().toString();

afterEach(() => jest.clearAllMocks());

describe("auth", () => {
  it("401s when the internal api key is missing", async () => {
    const res = await request(app).get(`/customers/${validId}`);
    expect(res.status).toBe(401);
  });

  it("401s when the internal api key is wrong", async () => {
    const res = await request(app)
      .get(`/customers/${validId}`)
      .set("x-internal-api-key", "wrong-key");
    expect(res.status).toBe(401);
  });
});

describe("GET /customers/:id", () => {
  it("400s on a malformed id", async () => {
    const res = await request(app).get("/customers/not-an-id").set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ID");
  });

  it("404s when the customer doesn't exist", async () => {
    Customer.findById.mockResolvedValue(null);
    const res = await request(app).get(`/customers/${validId}`).set(headers);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it("returns the customer when found", async () => {
    Customer.findById.mockResolvedValue({
      _id: validId,
      name: "Demo Customer",
      email: "demo@customer.com",
    });
    const res = await request(app).get(`/customers/${validId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("demo@customer.com");
  });

  it("500s when the database call throws", async () => {
    Customer.findById.mockRejectedValue(new Error("connection lost"));
    const res = await request(app).get(`/customers/${validId}`).set(headers);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
