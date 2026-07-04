process.env.INTERNAL_API_KEY = "test-internal-key";
process.env.MONGO_URI = "mongodb://unused/test";

jest.mock("../config/db", () => jest.fn());
jest.mock("../models/Product");

const request = require("supertest");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const app = require("../index");

const headers = { "x-internal-api-key": process.env.INTERNAL_API_KEY };
const validId = new mongoose.Types.ObjectId().toString();

afterEach(() => jest.clearAllMocks());

describe("auth", () => {
  it("401s when the internal api key is missing", async () => {
    const res = await request(app).get(`/products/${validId}`);
    expect(res.status).toBe(401);
  });
});

describe("GET /products/:id", () => {
  it("400s on a malformed id", async () => {
    const res = await request(app).get("/products/not-an-id").set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ID");
  });

  it("404s when the product doesn't exist", async () => {
    Product.findById.mockResolvedValue(null);
    const res = await request(app).get(`/products/${validId}`).set(headers);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("returns the product when found", async () => {
    Product.findById.mockResolvedValue({
      _id: validId,
      name: "Wireless Mouse",
      price: 25.99,
      stock: 100,
    });
    const res = await request(app).get(`/products/${validId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(25.99);
  });

  it("500s when the database call throws", async () => {
    Product.findById.mockRejectedValue(new Error("connection lost"));
    const res = await request(app).get(`/products/${validId}`).set(headers);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
