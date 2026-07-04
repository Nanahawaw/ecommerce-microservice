const amqp = require("amqplib");

const EXCHANGE = "payments.exchange";
const QUEUE = "transaction-history.queue";
const ROUTING_KEY = "transaction.created";
const DLX = "payments.dlx";
const DLQ = "transaction-history.dlq";

let channel;
async function connectRabbitMQ() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error("RABBITMQ_URL is not defined in environment variables");
  }

  const connection = await amqp.connect(url);
  // amqplib's promise API has no confirmSelect() method on a plain Channel —
  // publish confirms require a ConfirmChannel, obtained via
  // createConfirmChannel() up front rather than opted into afterward.
  channel = await connection.createConfirmChannel();

  await channel.assertExchange(DLX, "topic", { durable: true });
  await channel.assertQueue(DLQ, { durable: true });
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(QUEUE, {
    durable: true,
    deadLetterExchange: DLX,
    deadLetterRoutingKey: ROUTING_KEY,
  });
  await channel.bindQueue(DLQ, DLX, ROUTING_KEY);

  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

  console.log("[payment-service] Connected to RabbitMQ");
  return channel;
}

function getChannel() {
  if (!channel) {
    throw new Error(
      "RabbitMQ channel is not initialized. Call connectRabbitMQ() first.",
    );
  }
  return channel;
}

module.exports = {
  connectRabbitMQ,
  getChannel,
  EXCHANGE,
  QUEUE,
  ROUTING_KEY,
  DLX,
  DLQ,
};
