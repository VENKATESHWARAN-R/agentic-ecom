"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { allBrands, searchProducts } from "@/lib/services";
import type { Category, SearchFilters, SortOption } from "@/lib/types";
import { ProductGrid } from "./product-card";

type CatalogBrowserProps = {
  title: string;
  tagline?: string;
  category?: Category | "gaming";
  dealsOnly?: boolean;
};

/**
 * Filterable product listing. The URL query string is the source of truth
 * (q, max, brands, deals, stock, sort) so both the user's clicks and the
 * agent's navigation produce the same state.
 */
export function CatalogBrowser({ title, tagline, category, dealsOnly }: CatalogBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const query = params.get("q") ?? undefined;
  const maxPrice = params.get("max") ? Number(params.get("max")) : undefined;
  const brands = params.get("brands")?.split(",").filter(Boolean) ?? [];
  const dealsParam = params.get("deals") === "1";
  const inStockOnly = params.get("stock") === "1";
  const sort = (params.get("sort") as SortOption) ?? "relevance";

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const filters: SearchFilters = {
    query,
    category,
    maxPrice,
    brands: brands.length ? brands : undefined,
    dealsOnly: dealsOnly || dealsParam,
    inStockOnly,
    sort,
  };

  // The catalog is a small in-memory array, so filtering on every render is fine.
  const results = searchProducts(filters);
  const brandOptions = useMemo(
    () => (category && category !== "gaming" ? allBrands(category) : allBrands()),
    [category],
  );

  return (
    <>
      <h1 className="page-title">{title}</h1>
      {tagline && <p className="page-tagline">{tagline}</p>}
      <div className="catalog-layout">
        <aside className="filters">
          <div className="filter-group">
            <h4>Max price</h4>
            <input
              type="number"
              className="price-input"
              placeholder="e.g. 500"
              min={0}
              value={maxPrice ?? ""}
              onChange={(event) => setParam("max", event.target.value || undefined)}
            />
          </div>
          <div className="filter-group">
            <h4>Availability</h4>
            <label className="filter-option">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(event) => setParam("stock", event.target.checked ? "1" : undefined)}
              />
              In stock only
            </label>
            {!dealsOnly && (
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={dealsParam}
                  onChange={(event) => setParam("deals", event.target.checked ? "1" : undefined)}
                />
                On sale only
              </label>
            )}
          </div>
          <div className="filter-group">
            <h4>Brand</h4>
            {brandOptions.map((brand) => (
              <label key={brand} className="filter-option">
                <input
                  type="checkbox"
                  checked={brands.includes(brand)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...brands, brand]
                      : brands.filter((b) => b !== brand);
                    setParam("brands", next.length ? next.join(",") : undefined);
                  }}
                />
                {brand}
              </label>
            ))}
          </div>
        </aside>

        <div>
          <div className="toolbar">
            <span className="result-count">
              {results.length} product{results.length === 1 ? "" : "s"}
              {query ? ` for “${query}”` : ""}
            </span>
            <select
              value={sort}
              onChange={(event) => setParam("sort", event.target.value === "relevance" ? undefined : event.target.value)}
              aria-label="Sort products"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="rating">Best rated</option>
            </select>
          </div>
          <ProductGrid products={results} />
        </div>
      </div>
    </>
  );
}
