import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });
const password = await rl.question("Admin password: ");
rl.close();

if (!password.trim()) {
  console.error("Password cannot be empty.");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto
  .createHash("sha256")
  .update(`${salt}:${password}`)
  .digest("hex");

console.log(`sha256:${salt}:${hash}`);
