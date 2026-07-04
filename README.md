# ecommerce-microservice

A small microservices demo: a customer places an order for a single product,
the order service validates it against the customer and product services,
hands off to a (deliberately trivial) payment service, and the payment
service publishes the transaction to RabbitMQ for a worker to persist as
transaction history.

```
customer ──POST /orders──▶ order-service ──POST /payments──▶ payment-service
                                │  ▲                                │
                     GET /customers/:id   GET /products/:id         │ publish
                                │                                   ▼
                       customer-service          product-service   RabbitMQ
                                                                     │
                                                                     ▼
                                                          payment-worker ──▶ transaction history (Mongo)
```

## Services

| Service          | Port | Responsibility                                                 |
| ---------------- | ---- | -------------------------------------------------------------- |
| customer-service | 4001 | `GET /customers/:id` — read-only lookup of the seeded customer |
| product-service  | 4004 | `GET /products/:id` — read-only lookup of seeded products      |
| order-service    | 4002 | `POST /orders` — the customer-facing entry point               |
| payment-service  | 4003 | `POST /payments` — simulated payment, publishes to RabbitMQ    |
| payment-worker   | —    | Consumes the transaction queue, writes transaction history     |

customer-service, product-service and payment-service are internal-only:
every route (except `/health`) requires an `x-internal-api-key` header that
must match that service's `INTERNAL_API_KEY`. order-service is the only
public-facing service and holds the keys for the other three in its own
`.env` (`CUSTOMER_SERVICE_API_KEY`, `PRODUCT_SERVICE_API_KEY`,
`PAYMENT_SERVICE_API_KEY`).

## Running it locally

```bash
docker compose up --build
```

This starts Mongo, RabbitMQ, and all four services plus the payment worker,
using each service's healthcheck and `depends_on: condition: service_healthy`
to bring things up in the right order.

Then seed the demo customer and products (idempotent — safe to re-run):

```bash
docker compose --profile tools run --rm seed
```

RabbitMQ's management UI is at (guest/guest) if you
want to watch the `transaction-history.queue` fill up.

### Try the flow end-to-end

```bash
# 1. find the seeded customer/product ids, e.g. via mongosh or the seed logs
# 2. place an order (order-service is the only service that doesn't need an api key)
curl -X POST http://localhost:4002/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId": "<customerId>", "productId": "<productId>"}'
```

The response looks like:

```json
{
  "data": {
    "customerId": "...",
    "orderId": "...",
    "productId": "...",
    "orderStatus": "completed"
  }
}
```

`orderStatus` is randomly `completed` or `failed` — payment-service simulates
failures via `PAYMENT_FAILURE_RATE` (see below), since it's a stand-in for a
real payment gateway and not one itself.

## Environment variables

Each service has a `.env.example` documenting what it needs; copy it to
`.env` (already done for local dev — `.env` is git-ignored) and fill in real
values. Notable ones:

- `INTERNAL_API_KEY` (customer/product/payment) — the key that service
  requires on incoming requests.
- `CUSTOMER_SERVICE_API_KEY` / `PRODUCT_SERVICE_API_KEY` /
  `PAYMENT_SERVICE_API_KEY` (order-service) — the keys order-service sends
  _to_ those services; must match their respective `INTERNAL_API_KEY`.
- `PAYMENT_FAILURE_RATE` (payment-service) — fraction of payments (0–1) that
  are simulated as failed; defaults to `0.1`.
- `RABBITMQ_URL` (payment-service / worker) — e.g. `amqp://rabbitmq:5672`.

## Running the tests

Each service has its own Jest + Supertest suite, mocking out Mongoose models
and the RabbitMQ channel so tests don't need a real database or broker:

```bash
cd services/<service-name>
npm test
```

## Known limitations

This is a demo scoped to the assignment, not a production system. A few
things are intentionally out of scope:

- **No reconciliation job for stuck orders.** order-service persists the
  order as `pending` before calling payment-service and updates it to
  `completed`/`failed` after. If the process crashes in between, that order
  stays `pending` forever with nothing to sweep it — there's no background
  job to reconcile orders against payment-service's state.
- **No graceful drain on shutdown beyond closing the DB/AMQP connections** —
  in-flight requests aren't drained before a service exits.
- **Payment-service is intentionally not a real payment integration** — per
  the assignment, it simulates success/failure with `Math.random()` against
  `PAYMENT_FAILURE_RATE` rather than calling out to a payment provider.
