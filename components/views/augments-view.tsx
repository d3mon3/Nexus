"use client";

import { Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n";
import { useAugmentTiers } from "@/lib/queries";
import { AugmentList } from "../augments/augment-list";
import { Card, CardBody, CardHeader } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { Skeleton } from "../ui/skeleton";
import { Segmented } from "../ui/tabs";

type AugMode = "arena" | "aram-mayhem";

/** Augment tier list for Arena and ARAM Mayhem (all champions). */
export function AugmentsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode: AugMode = params?.get("mode") === "aram-mayhem" ? "aram-mayhem" : "arena";
  const q = useAugmentTiers(mode);
  const d = q.data?.data;
  return (
    <div className="space-y-3">
      <PageHeader
        title={t("Augment tiers")}
        description={t("Which augments win most, from real Arena and ARAM Mayhem games. For one champion, open its build in that mode.")}
        actions={
          <Segmented
            value={mode}
            onChange={(v) => router.replace(`${pathname}?mode=${v}`)}
            label={t("Mode")}
            items={[
              { value: "arena", label: t("Arena") },
              { value: "aram-mayhem", label: t("ARAM Chaos") },
            ]}
          />
        }
      />
      <Card>
        <CardHeader
          title={mode === "arena" ? t("Arena") : t("ARAM Chaos")}
          icon={<Sparkles className="size-4 text-primary" />}
          action={d?.games ? <span className="text-xs text-muted">{t("{0} games · patch {1}", [d.games.toLocaleString(), d.patch ?? "-"])}</span> : null}
        />
        <CardBody className="pt-0">
          {q.isLoading ? <Skeleton className="h-[400px]" /> : <AugmentList augments={d?.augments ?? []} arena={mode === "arena"} />}
        </CardBody>
      </Card>
    </div>
  );
}
