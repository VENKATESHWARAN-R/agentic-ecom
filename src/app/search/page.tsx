import { Suspense } from "react";
import { SearchResults } from "./search-results";

export const metadata = { title: "Search — Voltti" };

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
