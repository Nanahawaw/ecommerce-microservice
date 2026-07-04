const axios = require("axios");

async function callService({
  url,
  method = "GET",
  data,
  timeoutMs = 3000,
  apiKey,
  correlationId,
}) {
  const headers = {};
  if (apiKey) headers["x-internal-api-key"] = apiKey;
  if (correlationId) headers["x-correlation-id"] = correlationId;

  try {
    const response = await axios({
      url,
      method,
      data,
      timeout: timeoutMs,
      headers,
    });
    return { ok: true, status: response.status, body: response.data };
  } catch (err) {
    if (err.response) {
      return {
        ok: false,
        status: err.response.status,
        body: err.response.data,
      };
    }
    return { ok: false, status: null, body: null, networkError: err.message };
  }
}

async function callServiceWithRetry(options, retries = 2, backoffMs = 300) {
  let lastResult;
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastResult = await callService(options);
    if (lastResult.ok) return lastResult;
    if (lastResult.status && lastResult.status < 500) return lastResult;
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }
  return lastResult;
}

module.exports = { callService, callServiceWithRetry };
