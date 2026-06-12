import { products } from "./catalog";
import type { GamingSetupRequest, Product, SearchFilters } from "./types";

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}

export function getProducts(ids: string[]) {
  return ids.map(getProduct).filter((product): product is Product => Boolean(product));
}

export function searchProducts(filters: SearchFilters = {}) {
  const query = filters.query?.trim().toLowerCase();
  return products
    .filter((product) => {
      if (filters.inStockOnly && product.stock <= 0) return false;
      if (filters.dealOnly && !product.originalPrice) return false;
      if (filters.category && filters.category !== "gaming" && product.category !== filters.category) return false;
      if (filters.category === "gaming" && !product.tags.includes("gaming")) return false;
      if (filters.maxPrice && product.price > filters.maxPrice) return false;
      if (filters.brand?.length && !filters.brand.some((brand) => product.brand.toLowerCase() === brand.toLowerCase())) {
        return false;
      }
      if (filters.tags?.length && !filters.tags.every((tag) => product.tags.includes(tag))) return false;
      if (!query) return true;

      const haystack = [
        product.name,
        product.brand,
        product.category,
        product.subcategory,
        product.description,
        ...product.tags,
        ...Object.values(product.specs).map(String),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      const dealA = a.originalPrice ? 1 : 0;
      const dealB = b.originalPrice ? 1 : 0;
      return dealB - dealA || b.rating - a.rating || a.price - b.price;
    });
}

export function getAlternatives(productId: string, limit = 3) {
  const product = getProduct(productId);
  if (!product) return [];
  return products
    .filter((candidate) => candidate.id !== productId)
    .filter((candidate) => candidate.category === product.category || candidate.tags.some((tag) => product.tags.includes(tag)))
    .filter((candidate) => candidate.stock > 0)
    .sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price))
    .slice(0, limit);
}

export function checkCompatibility(productIds: string[]) {
  const selected = getProducts(productIds);
  const warnings: string[] = [];
  const cpus = selected.filter((product) => product.compatibility?.cpuSocket);
  const boards = selected.filter((product) => product.compatibility?.motherboardSocket);
  const gpu = selected.find((product) => product.compatibility?.gpuLengthMm);
  const psu = selected.find((product) => product.compatibility?.psuWatts);

  for (const cpu of cpus) {
    for (const board of boards) {
      if (cpu.compatibility?.cpuSocket !== board.compatibility?.motherboardSocket) {
        warnings.push(`${cpu.name} uses ${cpu.compatibility?.cpuSocket}, but ${board.name} is ${board.compatibility?.motherboardSocket}.`);
      }
      if (cpu.compatibility?.memory && board.compatibility?.memory && cpu.compatibility.memory !== board.compatibility.memory) {
        warnings.push(`${cpu.name} expects ${cpu.compatibility.memory}, while ${board.name} lists ${board.compatibility.memory}.`);
      }
    }
  }

  const estimatedWatts = selected.reduce((total, product) => total + Number(product.compatibility?.estimatedWatts ?? 0), 0);
  if (psu?.compatibility?.psuWatts && estimatedWatts && psu.compatibility.psuWatts < estimatedWatts * 1.35) {
    warnings.push(`${psu.name} may be tight for this build. Estimated draw is ${estimatedWatts} W; target at least ${Math.ceil(estimatedWatts * 1.35)} W.`);
  }
  if (gpu?.stock === 0) warnings.push(`${gpu.name} is currently unavailable.`);

  return {
    selected,
    compatible: warnings.length === 0,
    warnings,
  };
}

export function recommendGamingSetup(request: GamingSetupRequest) {
  const candidates = searchProducts({
    category: request.preferLaptop ? "laptops" : "gaming",
    maxPrice: request.budget,
    inStockOnly: true,
  });

  const prebuilts = candidates.filter((product) => product.category === "desktops" || product.category === "laptops");
  const bestBase =
    prebuilts.find((product) => product.price <= request.budget * 0.9) ??
    prebuilts[0] ??
    searchProducts({ category: "desktops", inStockOnly: true })[0];

  const extras: Product[] = [];
  if (request.includeMonitor) {
    const monitor = searchProducts({ query: "monitor", maxPrice: Math.max(180, request.budget - bestBase.price), inStockOnly: true })[0];
    if (monitor) extras.push(monitor);
  }
  const headsetBudget = request.budget - bestBase.price - extras.reduce((sum, item) => sum + item.price, 0);
  if (headsetBudget >= 90) {
    const headset = searchProducts({ query: "headset", maxPrice: headsetBudget, inStockOnly: true })[0];
    if (headset) extras.push(headset);
  }

  const selected = [bestBase, ...extras].filter(Boolean);
  const totalPrice = selected.reduce((sum, product) => sum + product.price, 0);
  const overBudget = totalPrice > request.budget;
  const games = request.games?.length ? request.games.join(", ") : "modern competitive and AAA games";

  return {
    ids: selected.map((product) => product.id),
    products: selected,
    totalPrice,
    summary: `${bestBase.name} is the strongest fit for ${games} around ${formatPrice(request.budget)}.`,
    tradeoffs: [
      bestBase.category === "laptops" ? "Portable and simple, but less upgradeable than a tower." : "Better upgrade path than a laptop, but needs desk space and peripherals.",
      totalPrice <= request.budget ? `The current basket lands at ${formatPrice(totalPrice)}.` : `This lands at ${formatPrice(totalPrice)}, which is above budget.`,
      bestBase.tags.includes("deal") ? "It is currently discounted, so the value is stronger than usual." : "No active discount, but the performance match is solid.",
    ],
    warnings: overBudget ? ["The recommendation exceeds the requested budget; remove an accessory or choose the MiniForge 4060."] : [],
    alternatives: prebuilts.filter((product) => product.id !== bestBase.id).slice(0, 3),
  };
}

export function cartTotal(lines: { productId: string; quantity: number }[]) {
  return lines.reduce((total, line) => total + (getProduct(line.productId)?.price ?? 0) * line.quantity, 0);
}
