const crypto = require("crypto");

function correlationId(req, res, next) {
  req.correlationId = req.header("x-correlation-id") || crypto.randomUUID();
  res.setHeader("x-correlation-id", req.correlationId);
  next();
}

module.exports = correlationId;
