import { t } from "@/lib/i18n";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <Card className="mt-6">
      <EmptyState
        title={t("Page not found")}
        description={t("This page doesn't exist in the Nexus.")}
        action={
          <Link href="/">
            <Button variant="primary" size="sm">{t("Back home")}</Button>
          </Link>
        }
      />
    </Card>
  );
}
