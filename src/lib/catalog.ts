// The product catalog. The data itself lives in data/catalog.json — the single
// seed source shared with the Python backend (which loads it into SQLite at
// startup). Edit the JSON to change products; both sides pick it up.
import catalogData from "../../data/catalog.json";
import type { Category, Product } from "./types";

export const products = catalogData as unknown as Product[];

export const featuredIds: string[] = [
  "iphone-16-pro",
  "nzxt-player-three",
  "lg-ultragear-27gs75q",
  "legion-pro-5-16",
];

export const categoryMeta: Record<Category, { label: string; tagline: string }> = {
  phones: {
    label: "Phones",
    tagline: "Flagships and smart budget picks from every major brand.",
  },
  laptops: {
    label: "Laptops",
    tagline: "From featherweight ultrabooks to RTX-powered gaming rigs.",
  },
  desktops: {
    label: "Desktop PCs",
    tagline: "Prebuilt gaming towers, ready to play out of the box.",
  },
  components: {
    label: "PC Components",
    tagline: "CPUs, GPUs, and everything you need to build your own.",
  },
  monitors: {
    label: "Monitors",
    tagline: "High-refresh gaming panels and pin-sharp 4K workspaces.",
  },
  audio: {
    label: "Audio",
    tagline: "Headphones, earbuds, and speakers for play and focus.",
  },
  accessories: {
    label: "Accessories",
    tagline: "Mice, keyboards, and chargers that complete your setup.",
  },
  "smart-home": {
    label: "Smart Home",
    tagline: "Speakers, lights, and plugs that make your home smarter.",
  },
};
