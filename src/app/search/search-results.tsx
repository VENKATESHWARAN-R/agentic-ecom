"use client";

import { useSearchParams } from "next/navigation";
import { CatalogBrowser } from "@/components/catalog-browser";

export function SearchResults() {
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  return <CatalogBrowser title={query ? `Results for “${query}”` : "Search"} />;
}
