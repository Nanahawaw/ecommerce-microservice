const mongoose = require("mongoose");

async function seed() {
  const customerConn = await mongoose
    .createConnection("mongodb://mongo:27017/customer-service")
    .asPromise();
  const productConn = await mongoose
    .createConnection("mongodb://mongo:27017/product-service")
    .asPromise();

  const Customer = customerConn.model(
    "Customer",
    require("../../services/customer-service/src/models/Customer").schema,
  );
  const Product = productConn.model(
    "Product",
    require("../../services/product-service/src/models/Product").schema,
  );

  const existingCustomer = await Customer.findOne({
    email: "demo@customer.com",
  });
  if (!existingCustomer) {
    await Customer.create({
      name: "Demo Customer",
      email: "demo@customer.com",
    });
    console.log("[seed] created demo customer");
  } else {
    console.log("[seed] demo customer already exists — skipping");
  }

  const existingProducts = await Product.countDocuments();
  if (existingProducts === 0) {
    await Product.insertMany([
      { name: "Wireless Mouse", price: 25.99, stock: 100 },
      { name: "Mechanical Keyboard", price: 89.99, stock: 50 },
      { name: "USB-C Hub", price: 34.5, stock: 200 },
    ]);
    console.log("[seed] created demo products");
  } else {
    console.log("[seed] products already exist — skipping");
  }

  await customerConn.close();
  await productConn.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
