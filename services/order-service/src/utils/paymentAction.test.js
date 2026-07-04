jest.mock("./httpClient");

const { callServiceWithRetry } = require("./httpClient");
const { callPayment } = require("./paymentAction");

afterEach(() => jest.clearAllMocks());

describe("callPayment", () => {
  it("resolves normally on a 200", async () => {
    callServiceWithRetry.mockResolvedValue({
      ok: true,
      status: 200,
      body: { data: { status: "success" } },
    });

    await expect(
      callPayment({ data: {}, correlationId: "x" }),
    ).resolves.toEqual({ ok: true, status: 200, body: { data: { status: "success" } } });
  });

  it("resolves (does not throw) on a 4xx — payment-service is healthy, the request was bad", async () => {
    callServiceWithRetry.mockResolvedValue({
      ok: false,
      status: 400,
      body: { error: { code: "MISSING_FIELDS" } },
    });

    await expect(
      callPayment({ data: {}, correlationId: "x" }),
    ).resolves.toMatchObject({ ok: false, status: 400 });
  });

  it("throws on a 5xx so the circuit breaker counts it as a failure", async () => {
    callServiceWithRetry.mockResolvedValue({ ok: false, status: 503, body: null });

    await expect(callPayment({ data: {}, correlationId: "x" })).rejects.toThrow();
  });

  it("throws on a network error (status null) so the circuit breaker counts it", async () => {
    callServiceWithRetry.mockResolvedValue({
      ok: false,
      status: null,
      body: null,
      networkError: "ECONNREFUSED",
    });

    await expect(
      callPayment({ data: {}, correlationId: "x" }),
    ).rejects.toThrow("ECONNREFUSED");
  });

  it("attaches the original result to the thrown error so the fallback can recover it", async () => {
    const failedResult = { ok: false, status: 503, body: null };
    callServiceWithRetry.mockResolvedValue(failedResult);

    try {
      await callPayment({ data: {}, correlationId: "x" });
      throw new Error("expected callPayment to throw");
    } catch (err) {
      expect(err.result).toEqual(failedResult);
    }
  });
});
