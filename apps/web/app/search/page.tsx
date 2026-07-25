import { Suspense } from "react";
import { SearchPanel } from "../../components/SearchPanel";

export default function SearchPage() {
  return (
    <main className="page-shell">
      <Suspense>
        <SearchPanel />
      </Suspense>
    </main>
  );
}
