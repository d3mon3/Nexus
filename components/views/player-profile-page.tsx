"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { parseRiotId, profileHref, resolveRegion } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/states";
import { Onboarding } from "./dashboard-view";
import { ProfileView } from "./profile-view";

export function PlayerProfilePage({ region, riotId }: { region: string; riotId: string }) {
  const r = resolveRegion(region);
  const id = parseRiotId(riotId);
  if (!r || !id)
    return (
      <Card>
        <EmptyState title="Invalid profile address" description="Profiles look like /profile/euw/Name-TAG." />
      </Card>
    );
  return <ProfileView key={`${r.platform}:${id.gameName}#${id.tagLine}`} player={{ ...id, platform: r.platform }} variant="profile" />;
}

/** /profile → last viewed profile, else your own, else onboarding. */
export function ProfileLanding() {
  const router = useRouter();
  const { settings } = useSettings();
  const target = settings.recent[0] ?? settings.myAccount;
  useEffect(() => {
    if (target) router.replace(profileHref(target.platform, target.gameName, target.tagLine));
  }, [target, router]);
  return target ? null : <Onboarding />;
}
