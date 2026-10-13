import { t } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-3" role="status" aria-label={t("Loading")}>
      <Skeleton className="h-16 rounded-[14px]" />
      <Skeleton className="h-[420px] rounded-[14px]" />
    </div>
  );
}
