import { searchCustomersByPhone } from "./src/app/actions/customers";

async function run() {
  console.log("Starting search...");
  const t = Date.now();
  const res = await searchCustomersByPhone("0333480679");
  console.log("Result:", res);
  console.log(`Time taken: ${Date.now() - t}ms`);
  process.exit(0);
}

run().catch(console.error);
