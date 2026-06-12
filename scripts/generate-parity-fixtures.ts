/**
 * Generates behavior-parity fixtures from the TypeScript domain logic.
 * The Python backend's pytest suite replays these inputs and asserts identical
 * outputs, so the agent-tool behavior cannot drift from the original
 * implementation. Run with: npx tsx scripts/generate-parity-fixtures.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkCompatibility,
  formatDate,
  formatPrice,
  getAlternatives,
  productSummary,
  recommendGamingSetup,
  recommendPcBuild,
  searchProducts,
} from "../src/lib/services";
import type { GamingSetupRequest, OwnedRef, PcBuildRequest, SearchFilters } from "../src/lib/types";

const searchCases: SearchFilters[] = [
  {},
  { query: "noise cancelling headphones" },
  { query: "rtx 5070" },
  { query: "gaming laptop", maxPrice: 1500 },
  { category: "phones", maxPrice: 500, dealsOnly: true },
  { category: "gaming" },
  { category: "components", brands: ["AMD", "MSI"] },
  { category: "monitors", inStockOnly: true, sort: "price-asc" },
  { query: "ddr5", sort: "price-desc" },
  { category: "audio", sort: "rating" },
  { tags: ["gaming"], category: "laptops", inStockOnly: true, sort: "price-desc" },
  { query: "headset", tags: ["gaming"], maxPrice: 200, inStockOnly: true },
  { category: "accessories", tags: ["gaming", "mouse"], maxPrice: 120, inStockOnly: true },
  { minPrice: 1000, sort: "price-asc" },
];

const alternativeCases = [
  "rtx-5070",
  "ryzen-7-7800x3d",
  "fractal-terra-itx",
  "iphone-16",
  "no-such-product",
];

// Owned refs mirroring Aino's and Sami's derived profiles (stable ids + provenance).
const ainoOwned: OwnedRef[] = [
  { productId: "msi-b650-tomahawk", orderNumber: "VLT-1002", orderedOn: "2026-05-27T00:00:00.000Z" },
  { productId: "corsair-vengeance-32gb-ddr5", orderNumber: "VLT-1002", orderedOn: "2026-05-27T00:00:00.000Z" },
  { productId: "ryzen-7-7800x3d", orderNumber: "VLT-1003", orderedOn: "2026-06-08T00:00:00.000Z" },
  { productId: "fractal-terra-itx", orderNumber: "VLT-1001", orderedOn: "2026-05-05T00:00:00.000Z" },
  { productId: "bequiet-pure-power-12m-650", orderNumber: "VLT-1001", orderedOn: "2026-05-05T00:00:00.000Z" },
];

const compatCases: { productIds: string[]; owned?: OwnedRef[] }[] = [
  { productIds: ["ryzen-7-7800x3d", "msi-b650-tomahawk", "corsair-vengeance-32gb-ddr5"] },
  { productIds: ["core-i7-14700k", "msi-b650-tomahawk"] },
  { productIds: ["core-i7-14700k"], owned: ainoOwned },
  { productIds: ["rtx-5090"], owned: ainoOwned },
  { productIds: ["rtx-5070", "nzxt-h5-flow", "corsair-rm850e"] },
  { productIds: ["tplink-archer-txe75e"], owned: ainoOwned },
  { productIds: ["ryzen-7-7800x3d", "msi-z790-tomahawk", "corsair-vengeance-32gb-ddr5", "rtx-5090", "bequiet-pure-power-12m-650", "fractal-terra-itx"] },
  { productIds: ["iphone-16", "airpods-pro-2"] },
];

const buildCases: PcBuildRequest[] = [
  { budget: 800 },
  { budget: 1200, cpuPlatform: "amd" },
  { budget: 1500 },
  { budget: 1500, cpuPlatform: "amd", games: ["Counter-Strike 2", "Baldur's Gate 3"] },
  { budget: 2000, cpuPlatform: "intel", brandPreference: ["nvidia"] },
  { budget: 3000, brandPreference: ["nvidia"] },
  { budget: 500 },
];

const setupCases: GamingSetupRequest[] = [
  { budget: 1500 },
  { budget: 1500, preferLaptop: true },
  { budget: 2500, includeMonitor: true, includePeripherals: true },
  { budget: 2000, preferLaptop: true, includePeripherals: true, games: ["Cyberpunk 2077"] },
  { budget: 900, includeMonitor: true },
  { budget: 4000, brandPreference: ["asus"], includeMonitor: true },
];

const fixtures = {
  formatPrice: [0, 1, 49.9, 199, 649, 1234.56, 1500, 2999, 12345].map((value) => ({
    input: value,
    output: formatPrice(value),
  })),
  formatDate: ["2026-05-27T10:30:00.000Z", "2026-01-02T00:00:00.000Z", "2025-12-31T23:59:59.000Z"].map((iso) => ({
    input: iso,
    output: formatDate(iso),
  })),
  searchProducts: searchCases.map((filters) => ({
    input: filters,
    output: searchProducts(filters).map((p) => p.id),
  })),
  // Tool-contract shape: what the agent actually receives.
  searchCatalogTool: searchCases.slice(0, 6).map((filters) => ({
    input: filters,
    output: {
      totalMatches: searchProducts(filters).length,
      products: searchProducts(filters).slice(0, 8).map(productSummary),
    },
  })),
  getAlternatives: alternativeCases.map((productId) => ({
    input: productId,
    output: getAlternatives(productId).map((p) => p.id),
  })),
  checkCompatibility: compatCases.map((input) => ({
    input,
    output: checkCompatibility(input.productIds, input.owned ?? []),
  })),
  recommendPcBuild: buildCases.map((input) => {
    const result = recommendPcBuild(input);
    return {
      input,
      output: {
        ids: result.ids,
        totalPrice: result.totalPrice,
        summary: result.summary,
        tradeoffs: result.tradeoffs,
        compatibility: result.compatibility,
      },
    };
  }),
  recommendGamingSetup: setupCases.map((input) => {
    const result = recommendGamingSetup(input);
    return {
      input,
      output: {
        ids: result.ids,
        totalPrice: result.totalPrice,
        summary: result.summary,
        tradeoffs: result.tradeoffs,
        warnings: result.warnings,
        alternatives: result.alternatives?.map((p) => p.id) ?? [],
      },
    };
  }),
};

const outDir = join(__dirname, "..", "backend", "tests", "fixtures");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "parity.json"), JSON.stringify(fixtures, null, 2) + "\n");
console.log("Wrote backend/tests/fixtures/parity.json");
for (const [name, cases] of Object.entries(fixtures)) {
  console.log(`  ${name}: ${(cases as unknown[]).length} cases`);
}
