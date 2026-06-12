import Link from "next/link";
import {
  Cpu,
  Gamepad2,
  Headphones,
  House,
  Keyboard,
  Laptop,
  Monitor,
  Smartphone,
} from "lucide-react";
import { categoryMeta, featuredIds } from "@/lib/catalog";
import { getDeals, getProducts } from "@/lib/services";
import { ProductGrid } from "@/components/product-card";
import type { Category } from "@/lib/types";

const TILE_ICONS: { category: Category; icon: React.ReactNode }[] = [
  { category: "phones", icon: <Smartphone size={22} /> },
  { category: "laptops", icon: <Laptop size={22} /> },
  { category: "desktops", icon: <Gamepad2 size={22} /> },
  { category: "components", icon: <Cpu size={22} /> },
  { category: "monitors", icon: <Monitor size={22} /> },
  { category: "audio", icon: <Headphones size={22} /> },
  { category: "accessories", icon: <Keyboard size={22} /> },
  { category: "smart-home", icon: <House size={22} /> },
];

export default function HomePage() {
  const deals = getDeals().slice(0, 4);
  const featured = getProducts(featuredIds);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Tech that fits. Advice that checks out.</h1>
          <p>
            Shop phones, gaming rigs, and PC parts the usual way — or open the assistant and just say
            what you need. It searches the catalog, flags incompatible parts, and builds your cart with
            your approval.
          </p>
          <div className="hero-chips">
            <Link href="/deals" className="hero-chip">
              🔥 Today&apos;s deals
            </Link>
            <Link href="/c/components" className="hero-chip">
              🛠 Build a gaming PC
            </Link>
            <Link href="/c/phones" className="hero-chip">
              📱 New phones
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Shop by category</h2>
        </div>
        <div className="category-tiles">
          {TILE_ICONS.map(({ category, icon }) => (
            <Link key={category} href={`/c/${category}`} className="tile">
              <span className="tile-icon">{icon}</span>
              {categoryMeta[category].label}
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Top deals</h2>
          <Link href="/deals">View all deals →</Link>
        </div>
        <ProductGrid products={deals} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Featured</h2>
        </div>
        <ProductGrid products={featured} />
      </section>
    </>
  );
}
