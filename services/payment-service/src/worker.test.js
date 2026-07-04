jest.mock("./config/rabbitmq", () => ({
  connectRabbitMQ: jest.fn(),
  QUEUE: "transaction-history.queue",
}));
jest.mock("./models/Transaction");

const Transaction = require("./models/Transaction");
const { buildHandler } = require("./worker");

function makeMsg(payload) {
  return { content: Buffer.from(JSON.stringify(payload)) };
}

afterEach(() => jest.clearAllMocks());

describe("worker message handler", () => {
  it("persists the transaction (idempotent upsert on orderId) and acks", async () => {
    Transaction.findOneAndUpdate.mockResolvedValue({});
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const handler = buildHandler(channel);

    const payload = {
      customerId: "c1",
      orderId: "o1",
      productId: "p1",
      amount: 25.99,
      correlationId: "corr-1",
    };
    await handler(makeMsg(payload));

    expect(Transaction.findOneAndUpdate).toHaveBeenCalledWith(
      { orderId: "o1" },
      { $setOnInsert: payload },
      { upsert: true, returnDocument: "after" },
    );
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it("dead-letters a malformed message without requeueing", async () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const handler = buildHandler(channel);

    await handler({ content: Buffer.from("not valid json") });

    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(Transaction.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("requeues on a transient DB failure instead of dead-lettering", async () => {
    Transaction.findOneAndUpdate.mockRejectedValue(new Error("mongo blip"));
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const handler = buildHandler(channel);

    await handler(makeMsg({ customerId: "c1", orderId: "o1", productId: "p1", amount: 10 }));

    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it("no-ops on a null message (consumer cancellation notice)", async () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const handler = buildHandler(channel);

    await expect(handler(null)).resolves.toBeUndefined();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });
});
