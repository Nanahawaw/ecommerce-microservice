const axios = require("axios");

async function callService({
  url,
  method = "GET",
  data,
  timeoutMs = 3000,
  apiKey,
}) {
  try {
    const response = await axios({
      url,
      method,
      data,
      timeout: timeoutMs,
      headers: apiKey ? { "x-internal-api-key": apiKey } : {},
    });
    return { ok: true, status: response.status, body: response.data };
  } catch (err) {
    if (err.response) {
      // the dependency responded, just with an error status
      return {
        ok: false,
        status: err.response.status,
        body: err.response.data,
      };
    }
    // timeout, connection refused, DNS failure, etc. — the dependency never answered at all
    return { ok: false, status: null, body: null, networkError: err.message };
  }
}

module.exports = callService;
