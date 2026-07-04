const CircuitBreaker = require("opossum");
const { callServiceWithRetry } = require("./httpClient");

const paymentBreaker = new CircuitBreaker(
  (payload) =>
    callServiceWithRetry({
      url: `${process.env.PAYMENT_SERVICE_URL}/payments`,
      method: "POST",
      data: payload.data,
      apiKey: process.env.PAYMENT_SERVICE_API_KEY,
      correlationId: payload.correlationId,
    }),
  {
    timeout: 8000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
  },
);

paymentBreaker.on("open", () =>
  console.warn("[order-service] payment circuit OPEN — failing fast"),
);
paymentBreaker.on("halfOpen", () =>
  console.log("[order-service] payment circuit HALF-OPEN — testing recovery"),
);
paymentBreaker.on("close", () =>
  console.log("[order-service] payment circuit CLOSED — recovered"),
);

paymentBreaker.fallback(() => ({
  ok: false,
  status: null,
  body: null,
  circuitOpen: true,
}));

module.exports = paymentBreaker;
