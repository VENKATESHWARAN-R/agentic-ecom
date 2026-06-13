/**
 * One-off extraction of the hardcoded seed data into shared JSON files
 * (data/catalog.json, data/users.json) consumed by BOTH the Next.js app and
 * the Python backend's DB seed. Run with: npx tsx scripts/extract-seed-data.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { products } from "../src/lib/catalog";
import { userProfiles } from "../src/lib/users";

const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

writeFileSync(join(dataDir, "catalog.json"), JSON.stringify(products, null, 2) + "\n");
writeFileSync(join(dataDir, "users.json"), JSON.stringify(userProfiles, null, 2) + "\n");

console.log(`Wrote ${products.length} products and ${Object.keys(userProfiles).length} personas to data/`);
