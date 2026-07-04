function verifyInternalKey(req, res, next) {
  const key = req.header("x-internal-api-key");
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({
      error: { message: "Unauthorized", code: "UNAUTHORIZED" },
    });
  }
  next();
}

module.exports = verifyInternalKey;
