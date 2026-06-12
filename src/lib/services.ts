import { products } from "./catalog";
import type {
  CartLine,
  CompatibilityResult,
  GamingSetupRequest,
  OwnedRef,
  PcBuildRequest,
  Product,
  SearchFilters,
} from "./types";

export function formatPrice(value: number) {
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Single home for date display — keep server/client renders consistent. */
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}

export function getProducts(ids: string[]) {
  return ids.map(getProduct).filter((product): product is Product => Boolean(product));
}

export function allBrands(category?: Product["category"]) {
  const pool = category ? products.filter((p) => p.category === category) : products;
  return [...new Set(pool.map((p) => p.brand))].sort();
}

export function searchProducts(filters: SearchFilters = {}) {
  const query = filters.query?.trim().toLowerCase();
  const terms = query ? query.split(/\s+/).filter(Boolean) : [];

  const matched = products.filter((product) => {
    if (filters.inStockOnly && product.stock <= 0) return false;
    if (filters.dealsOnly && !isDeal(product)) return false;
    if (filters.category === "gaming") {
      if (!product.tags.includes("gaming")) return false;
    } else if (filters.category && product.category !== filters.category) {
      return false;
    }
    if (filters.maxPrice && product.price > filters.maxPrice) return false;
    if (filters.minPrice && product.price < filters.minPrice) return false;
    if (
      filters.brands?.length &&
      !filters.brands.some((brand) => product.brand.toLowerCase() === brand.toLowerCase())
    ) {
      return false;
    }
    if (filters.tags?.length && !filters.tags.every((tag) => product.tags.includes(tag))) return false;
    if (!terms.length) return true;

    const haystack = [
      product.name,
      product.brand,
      product.category,
      product.subcategory,
      product.blurb,
      product.description,
      ...product.tags,
      ...Object.entries(product.specs).flat(),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });

  const sort = filters.sort ?? "relevance";
  return matched.sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "rating":
        return b.rating - a.rating;
      default: {
        const stockA = a.stock > 0 ? 1 : 0;
        const stockB = b.stock > 0 ? 1 : 0;
        const dealA = isDeal(a) ? 1 : 0;
        const dealB = isDeal(b) ? 1 : 0;
        return stockB - stockA || dealB - dealA || b.rating - a.rating || a.price - b.price;
      }
    }
  });
}

export function isDeal(product: Product) {
  return Boolean(product.originalPrice && product.originalPrice > product.price);
}

export function discountPercent(product: Product) {
  if (!isDeal(product)) return 0;
  return Math.round((1 - product.price / product.originalPrice!) * 100);
}

export function getDeals() {
  return searchProducts({ dealsOnly: true });
}

/** In-stock alternatives for an unavailable or unsuitable product, closest price first. */
export function getAlternatives(productId: string, limit = 4) {
  const product = getProduct(productId);
  if (!product) return [];
  return products
    .filter((candidate) => candidate.id !== productId && candidate.stock > 0)
    .filter(
      (candidate) =>
        (candidate.category === product.category && candidate.subcategory === product.subcategory) ||
        (candidate.category === product.category &&
          candidate.tags.some((tag) => product.tags.includes(tag))),
    )
    .sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price))
    .slice(0, limit);
}

/**
 * Deterministic PC-part compatibility check: CPU socket vs motherboard socket,
 * memory generation across CPU/board/RAM, GPU length vs case clearance,
 * PSU headroom, and stock availability.
 *
 * `owned` lets the check span *across orders*: parts the customer already owns
 * are unioned into the build and any warning that involves one is attributed to
 * its purchase ("…from your order VLT-1002 on 27 May 2026"). See docs/agent-contract.md.
 */
export function checkCompatibility(productIds: string[], owned: OwnedRef[] = []): CompatibilityResult {
  const ownedMap = new Map(owned.map((ref) => [ref.productId, ref]));
  const candidateIds = new Set(productIds);
  // Union candidate + owned ids, de-duplicated, preserving order.
  const allIds = [...new Set([...productIds, ...owned.map((ref) => ref.productId)])];
  const selected = getProducts(allIds);
  const warnings: string[] = [];
  const notes: string[] = [];

  /** Attribution suffix for an owned part, "" for a candidate part. */
  const own = (product: Product) => {
    const ref = ownedMap.get(product.id);
    return ref ? ` (from your order ${ref.orderNumber} on ${formatDate(ref.orderedOn)})` : "";
  };

  const cpus = selected.filter((p) => p.subcategory === "cpu");
  const boards = selected.filter((p) => p.subcategory === "motherboard");
  const gpus = selected.filter((p) => p.subcategory === "gpu");
  const ramKits = selected.filter((p) => p.subcategory === "ram");
  const psus = selected.filter((p) => p.compat?.psuWatts);
  const cases = selected.filter((p) => p.compat?.maxGpuLengthMm);

  for (const cpu of cpus) {
    for (const board of boards) {
      if (cpu.compat?.socket && board.compat?.socket && cpu.compat.socket !== board.compat.socket) {
        warnings.push(
          `${cpu.name}${own(cpu)} uses socket ${cpu.compat.socket}, but ${board.name}${own(board)} is a ${board.compat.socket} board. These are not compatible.`,
        );
      }
    }
  }

  const memoryParts = [...cpus, ...boards, ...ramKits].filter((p) => p.compat?.memoryType);
  const memoryTypes = new Set(memoryParts.map((p) => p.compat!.memoryType));
  if (memoryTypes.size > 1) {
    const detail = memoryParts.map((p) => `${p.name}${own(p)} (${p.compat!.memoryType})`).join(", ");
    warnings.push(`Mixed memory generations in this build: ${detail}. All parts must use the same memory type.`);
  }

  for (const gpu of gpus) {
    for (const pcCase of cases) {
      if (
        gpu.compat?.gpuLengthMm &&
        pcCase.compat?.maxGpuLengthMm &&
        gpu.compat.gpuLengthMm > pcCase.compat.maxGpuLengthMm
      ) {
        warnings.push(
          `${gpu.name}${own(gpu)} is ${gpu.compat.gpuLengthMm} mm long, but ${pcCase.name}${own(pcCase)} fits GPUs up to ${pcCase.compat.maxGpuLengthMm} mm.`,
        );
      }
    }
  }

  const estimatedDraw = selected.reduce((sum, p) => sum + (p.compat?.drawWatts ?? 0), 0);
  if (estimatedDraw > 0) {
    const headroomTarget = Math.ceil((estimatedDraw + 150) * 1.3);
    notes.push(`Estimated component draw ≈ ${estimatedDraw + 150} W including the rest of the system.`);
    for (const psu of psus) {
      if (psu.compat!.psuWatts! < headroomTarget) {
        warnings.push(
          `${psu.name}${own(psu)} (${psu.compat!.psuWatts} W) is tight for this build — recommended at least ${headroomTarget} W for safe headroom.`,
        );
      }
    }
  }

  for (const product of selected) {
    if (product.stock <= 0) {
      warnings.push(`${product.name}${own(product)} is currently out of stock.`);
    }
  }

  // Redundancy nudge (advisory note, never a blocking warning): a Wi-Fi adapter
  // in the candidate set when an owned motherboard already has built-in Wi-Fi.
  const ownedWifiBoards = boards.filter((b) => ownedMap.has(b.id) && b.tags.includes("wifi"));
  const wifiAdapters = selected.filter((p) => p.subcategory === "wifi-adapter" && candidateIds.has(p.id));
  if (ownedWifiBoards.length && wifiAdapters.length) {
    const board = ownedWifiBoards[0];
    notes.push(
      `Your ${board.name}${own(board)} already has built-in Wi-Fi — the ${wifiAdapters[0].name} may be unnecessary.`,
    );
  }

  if (cpus.length && boards.length && !ramKits.length) {
    notes.push("No RAM kit selected yet.");
  }
  if (gpus.length && !psus.length) {
    notes.push("No power supply selected yet.");
  }

  return {
    productIds: selected.map((p) => p.id),
    compatible: warnings.length === 0,
    warnings,
    notes,
  };
}

const BUILD_SHARE: Record<string, number> = {
  gpu: 0.38,
  cpu: 0.22,
  motherboard: 0.12,
  ram: 0.08,
  ssd: 0.08,
  psu: 0.06,
  case: 0.06,
};

function pickPart(
  subcategory: string,
  maxPrice: number,
  prefer?: (p: Product) => boolean,
  exclude?: (p: Product) => boolean,
) {
  const pool = products
    .filter((p) => p.subcategory === subcategory && p.stock > 0)
    .filter((p) => !exclude?.(p))
    .sort((a, b) => b.price - a.price);
  const preferred = prefer ? pool.filter(prefer) : pool;
  const withinBudget = (list: Product[]) => list.find((p) => p.price <= maxPrice);
  return withinBudget(preferred) ?? withinBudget(pool) ?? preferred.at(-1) ?? pool.at(-1);
}

/**
 * Deterministic part-picker for a custom gaming PC. Allocates the budget across
 * part types, keeps the platform (socket + memory) consistent, and runs the
 * compatibility check on the result.
 */
export function recommendPcBuild(request: PcBuildRequest) {
  const budget = request.budget;
  const prefersBrand = (p: Product) =>
    !request.brandPreference?.length ||
    request.brandPreference.some(
      (b) => p.brand.toLowerCase().includes(b.toLowerCase()) || p.tags.includes(b.toLowerCase()),
    );

  const wantsAmdCpu = request.cpuPlatform === "amd";
  const wantsIntelCpu = request.cpuPlatform === "intel";
  const cpu = pickPart(
    "cpu",
    budget * BUILD_SHARE.cpu,
    (p) =>
      (wantsAmdCpu ? p.brand === "AMD" : wantsIntelCpu ? p.brand === "Intel" : true) && prefersBrand(p),
  );
  const memoryType = cpu?.compat?.memoryType;
  const board = cpu
    ? pickPart(
        "motherboard",
        budget * BUILD_SHARE.motherboard,
        undefined,
        (p) =>
          p.compat?.socket !== cpu.compat?.socket ||
          (!!memoryType && !!p.compat?.memoryType && p.compat.memoryType !== memoryType),
      )
    : undefined;
  const ram = pickPart("ram", budget * BUILD_SHARE.ram, undefined, (p) =>
    memoryType ? p.compat?.memoryType !== memoryType : false,
  );
  const gpu = pickPart("gpu", budget * BUILD_SHARE.gpu, prefersBrand);
  const storage = pickPart("ssd", budget * BUILD_SHARE.ssd);
  const pcCase = pickPart("case", budget * BUILD_SHARE.case, (p) =>
    gpu?.compat?.gpuLengthMm ? (p.compat?.maxGpuLengthMm ?? 0) >= gpu.compat.gpuLengthMm : true,
  );
  const draw = (cpu?.compat?.drawWatts ?? 0) + (gpu?.compat?.drawWatts ?? 0);
  const psu = pickPart("psu", budget * BUILD_SHARE.psu, (p) => (p.compat?.psuWatts ?? 0) >= (draw + 150) * 1.3);

  const parts = [cpu, board, ram, gpu, storage, psu, pcCase].filter((p): p is Product => Boolean(p));
  const ids = parts.map((p) => p.id);
  const totalPrice = parts.reduce((sum, p) => sum + p.price, 0);
  const compatibility = checkCompatibility(ids);
  const games = request.games?.length ? request.games.join(", ") : "modern AAA and competitive titles";

  const tradeoffs: string[] = [];
  if (totalPrice > budget) {
    tradeoffs.push(
      `The build lands at ${formatPrice(totalPrice)}, ${formatPrice(totalPrice - budget)} over budget — the GPU or CPU could be stepped down.`,
    );
  } else {
    tradeoffs.push(`Total ${formatPrice(totalPrice)} leaves ${formatPrice(budget - totalPrice)} of the budget unspent.`);
  }
  if (gpu && isDeal(gpu)) tradeoffs.push(`${gpu.name} is currently discounted, which stretches the budget further.`);
  if (cpu?.brand === "AMD") tradeoffs.push("The AM5 platform has a long upgrade path for future CPUs.");

  return {
    ids,
    parts,
    totalPrice,
    summary: `A ${cpu?.name ?? "—"} + ${gpu?.name ?? "—"} build for ${games}, targeting ${formatPrice(budget)}.`,
    tradeoffs,
    compatibility,
  };
}

/**
 * Recommends a prebuilt-based gaming setup (desktop or laptop, plus optional
 * monitor and peripherals) within budget.
 */
export function recommendGamingSetup(request: GamingSetupRequest) {
  const candidates = searchProducts({
    category: request.preferLaptop ? "laptops" : "desktops",
    tags: ["gaming"],
    inStockOnly: true,
    sort: "price-desc",
  }).filter(
    (p) =>
      !request.brandPreference?.length ||
      request.brandPreference.some((b) => p.brand.toLowerCase().includes(b.toLowerCase())),
  );

  const base =
    candidates.find((p) => p.price <= request.budget * 0.85) ??
    candidates.find((p) => p.price <= request.budget) ??
    candidates.at(-1);
  if (!base) {
    return { ids: [], products: [], totalPrice: 0, summary: "No gaming systems matched.", tradeoffs: [], warnings: ["No in-stock gaming systems found for these preferences."], alternatives: [] };
  }

  const extras: Product[] = [];
  let remaining = request.budget - base.price;
  if (request.includeMonitor && !request.preferLaptop) {
    const monitor = searchProducts({ category: "monitors", tags: ["gaming"], maxPrice: Math.max(200, remaining), inStockOnly: true })[0];
    if (monitor) {
      extras.push(monitor);
      remaining -= monitor.price;
    }
  }
  if (request.includePeripherals) {
    const headset = searchProducts({ query: "headset", tags: ["gaming"], maxPrice: Math.max(80, remaining), inStockOnly: true })[0];
    if (headset) {
      extras.push(headset);
      remaining -= headset.price;
    }
    const mouse = searchProducts({ category: "accessories", tags: ["gaming", "mouse"], maxPrice: Math.max(60, remaining), inStockOnly: true })[0];
    if (mouse) {
      extras.push(mouse);
      remaining -= mouse.price;
    }
  }

  const selected = [base, ...extras];
  const totalPrice = selected.reduce((sum, p) => sum + p.price, 0);
  const games = request.games?.length ? request.games.join(", ") : "modern competitive and AAA games";

  return {
    ids: selected.map((p) => p.id),
    products: selected,
    totalPrice,
    summary: `${base.name} as the core system for ${games}, around ${formatPrice(request.budget)}.`,
    tradeoffs: [
      base.category === "laptops"
        ? "A laptop is portable and complete out of the box, but less upgradeable than a tower."
        : "A tower gives the best upgrade path; remember peripherals if you don't own any.",
      totalPrice <= request.budget
        ? `The full setup lands at ${formatPrice(totalPrice)}, within budget.`
        : `The setup is ${formatPrice(totalPrice - request.budget)} over budget — drop an accessory or step the system down.`,
      ...(isDeal(base) ? [`${base.name} is currently ${discountPercent(base)}% off.`] : []),
    ],
    warnings: totalPrice > request.budget ? [`Total ${formatPrice(totalPrice)} exceeds the ${formatPrice(request.budget)} budget.`] : [],
    alternatives: candidates.filter((p) => p.id !== base.id).slice(0, 3),
  };
}

export function cartTotal(lines: CartLine[]) {
  return lines.reduce((total, line) => total + (getProduct(line.productId)?.price ?? 0) * line.quantity, 0);
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/** Compact product shape for agent context / tool results (keeps token use down). */
export function productSummary(product: Product) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    price: product.price,
    originalPrice: product.originalPrice,
    inStock: product.stock > 0,
    stock: product.stock,
    rating: product.rating,
    tags: product.tags,
    blurb: product.blurb,
    compat: product.compat,
  };
}
