import { notFound } from "next/navigation";
import { Suspense } from "react";
import { categoryMeta } from "@/lib/catalog";
import type { Category } from "@/lib/types";
import { CatalogBrowser } from "@/components/catalog-browser";

const CATEGORIES = Object.keys(categoryMeta) as Category[];

export function generateStaticParams() {
  return CATEGORIES.map((slug) => ({ slug }));
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!CATEGORIES.includes(slug as Category)) notFound();
  const meta = categoryMeta[slug as Category];

  return (
    <Suspense>
      <CatalogBrowser title={meta.label} tagline={meta.tagline} category={slug as Category} />
    </Suspense>
  );
}
