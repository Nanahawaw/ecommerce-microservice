require("dotenv").config();
const mongoose = require("mongoose");
const { connectRabbitMQ, QUEUE } = require("./config/rabbitmq");
const Transaction = require("./models/Transaction");

// Builds the per-message consumer callback. Takes the channel explicitly
// (rather than reaching for the module-level one) so it can be unit tested
// against a fake channel without a real RabbitMQ connection.
function buildHandler(channel) {
  return async function handleMessage(msg) {
    if (!msg) return;

    let data;
    try {
      data = JSON.parse(msg.content.toString());
    } catch (err) {
      console.error(
        "[worker] malformed message, dead-lettering:",
        err.message,
      );
      return channel.nack(msg, false, false); // false, false = don't requeue, send straight to DLQ
    }

    try {
      // upsert on orderId — idempotent, safe against RabbitMQ's at-least-once redelivery
      await Transaction.findOneAndUpdate(
        { orderId: data.orderId },
        { $setOnInsert: { ...data } },
        { upsert: true, returnDocument: "after" },
      );
      console.log(
        `[worker][${data.correlationId}] recorded transaction for order ${data.orderId}`,
      );
      channel.ack(msg); // only ack AFTER the DB write succeeds
    } catch (err) {
      console.error(
        `[worker][${data.correlationId}] failed to persist transaction:`,
        err.message,
      );
      channel.nack(msg, false, true); // true = requeue, worth retrying — this failure is likely transient (DB blip)
    }
  };
}

async function start() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is required");
  await mongoose.connect(mongoUri);
  console.log("[worker] connected to Mongo");

  const channel = await connectRabbitMQ();
  console.log("[worker] listening on", QUEUE);

  channel.consume(QUEUE, buildHandler(channel), { noAck: false }); // manual ack mode — never auto-ack before the DB write is confirmed
}

if (require.main === module) {
  start().catch((err) => {
    console.error("[worker] fatal startup error:", err.message);
    process.exit(1);
  });

  process.on("SIGTERM", () => {
    console.log("[worker] SIGTERM received, shutting down");
    mongoose.connection.close(false, () => process.exit(0));
  });
}

module.exports = { buildHandler, start };
