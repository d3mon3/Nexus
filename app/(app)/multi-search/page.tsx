import { Suspense } from "react";
import { MultiSearchView } from "@/components/views/multi-search-view";

export const metadata = { title: "Multi Search" };

export default function Page() {
  return (
    <Suspense>
      <MultiSearchView />
    </Suspense>
  );
}
