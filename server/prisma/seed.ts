import * as dotenv from "dotenv";
dotenv.config({ override: true });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function deleteAllData(orderedFileNames: string[]) {
  const modelNames = orderedFileNames.map((fileName) => {
    return path.basename(fileName, path.extname(fileName));
  });

  for (const modelName of modelNames) {
    const model: any = prisma[modelName as keyof typeof prisma];
    if (model) {
      await model.deleteMany({});
      console.log(`Cleared data from ${modelName}`);
    } else {
      console.error(
        `Model ${modelName} not found. Please ensure the model name is correctly specified.`
      );
    }
  }
}

async function seedNewTables() {
  console.log("\n--- Seeding new tables: Orders, Invoices, Discounts ---");

  const products = await prisma.products.findMany({ take: 10 });
  const users = await prisma.users.findMany({ take: 10 });

  if (products.length === 0 || users.length === 0) {
    console.error("No products or users found. Skipping new tables seed.");
    return;
  }

  // SEED ORDERS
  const statuses = ["pending", "completed", "cancelled"];
  const orders = [];
  for (let i = 0; i < 50; i++) {
    const product = products[i % products.length];
    const user = users[i % users.length];
    const quantity = Math.floor(Math.random() * 10) + 1;
    // 15 pertama = pending agar ada data pending orders
    const status = i < 15 ? "pending" : statuses[Math.floor(Math.random() * 3)];
    orders.push({
      orderId: uuidv4(),
      productId: product.productId,
      userId: user.userId,
      quantity,
      totalAmount: product.price * quantity,
      status,
      timestamp: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    });
  }
  await prisma.orders.createMany({ data: orders });
  console.log(`✓ Seeded orders (${orders.length} rows)`);

  // SEED INVOICES
  const invoices = [];
  for (let i = 0; i < 30; i++) {
    const user = users[i % users.length];
    // 13 pertama = unpaid agar ada data dues
    const isPaid = i >= 13;
    invoices.push({
      invoiceId: uuidv4(),
      userId: user.userId,
      amount: Math.floor(Math.random() * 5000) + 100,
      status: isPaid ? "paid" : "unpaid",
      dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
    });
  }
  await prisma.invoices.createMany({ data: invoices });
  console.log(`✓ Seeded invoices (${invoices.length} rows)`);

  // SEED DISCOUNTS
  const discounts = [];
  for (let i = 0; i < 40; i++) {
    const product = products[i % products.length];
    const discountPercent = [5, 10, 15, 20, 25][Math.floor(Math.random() * 5)];
    discounts.push({
      discountId: uuidv4(),
      productId: product.productId,
      discountPercent,
      amount: (product.price * discountPercent) / 100,
      timestamp: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    });
  }
  await prisma.discounts.createMany({ data: discounts });
  console.log(`✓ Seeded discounts (${discounts.length} rows)`);

  console.log("--- New tables seeding complete ---\n");
}

async function main() {
  const dataDirectory = path.join(__dirname, "seedData");

  const orderedFileNames = [
    "expenseByCategory.json",
    "expenses.json",
    "expenseSummary.json",
    "salesSummary.json",
    "sales.json",
    "purchaseSummary.json",
    "purchases.json",
    "users.json",
    "products.json",
  ];

  await deleteAllData(orderedFileNames);

  const insertOrder = [...orderedFileNames].reverse();

  for (const fileName of insertOrder) {
    const filePath = path.join(dataDirectory, fileName);
    const jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const modelName = path.basename(fileName, path.extname(fileName));
    const model: any = prisma[modelName as keyof typeof prisma];

    if (!model) {
      console.error(`No Prisma model matches the file name: ${fileName}`);
      continue;
    }

    for (const data of jsonData) {
      await model.create({ data });
    }

    console.log(`Seeded ${modelName} with data from ${fileName}`);
  }

  // Seed tabel baru setelah data utama tersedia
  await seedNewTables();
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });