import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog-browser";

export const metadata = { title: "Deals — Voltti" };

export default function DealsPage() {
  return (
    <Suspense>
      <CatalogBrowser
        title="Deals"
        tagline="Limited-time discounts across the whole catalog."
        dealsOnly
      />
    </Suspense>
  );
}
