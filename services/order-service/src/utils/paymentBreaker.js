const CircuitBreaker = require("opossum");
const { callPayment } = require("./paymentAction");

const paymentBreaker = new CircuitBreaker(callPayment, {
  timeout: 8000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
});

paymentBreaker.on("open", () =>
  console.warn("[order-service] payment circuit OPEN — failing fast"),
);
paymentBreaker.on("halfOpen", () =>
  console.log("[order-service] payment circuit HALF-OPEN — testing recovery"),
);
paymentBreaker.on("close", () =>
  console.log("[order-service] payment circuit CLOSED — recovered"),
);

// err.result is set when callPayment rejected with a real downstream
// failure (see paymentAction.js) — preserve it so the caller can tell
// "payment failed" apart from "breaker is open / timed out".
paymentBreaker.fallback((payload, err) => {
  if (err && err.result) return err.result;
  return { ok: false, status: null, body: null, circuitOpen: true };
});

module.exports = paymentBreaker;
