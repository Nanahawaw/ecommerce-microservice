const { callServiceWithRetry } = require("./httpClient");

async function callPayment(payload) {
  const result = await callServiceWithRetry({
    url: `${process.env.PAYMENT_SERVICE_URL}/payments`,
    method: "POST",
    data: payload.data,
    apiKey: process.env.PAYMENT_SERVICE_API_KEY,
    correlationId: payload.correlationId,
  });

  if (!result.ok && (result.status === null || result.status >= 500)) {
    const err = new Error(
      result.networkError ||
        `payment service responded with status ${result.status}`,
    );
    err.result = result;
    throw err;
  }

  return result;
}

module.exports = { callPayment };
