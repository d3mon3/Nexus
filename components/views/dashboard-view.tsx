"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { parseRiotId, REGIONS, type Platform } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { ProfileView } from "./profile-view";
import { PlayersCard } from "../profile/cards";

export function DashboardView() {
  const { settings } = useSettings();
  if (!settings.myAccount) return <Onboarding />;
  return <ProfileView player={settings.myAccount} variant="dashboard" />;
}

/** Shown when no own account is configured: link a Riot ID to personalise the dashboard. */
export function Onboarding() {
  const { settings, update } = useSettings();
  const [value, setValue] = useState("");
  const [region, setRegion] = useState<Platform>(settings.region);
  const parsed = parseRiotId(value);
  return (
    <div className="space-y-3">
      <Card className="glow-border mx-auto mt-6 max-w-xl p-6 text-center">
        <Sparkles className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 text-2xl font-bold">Welcome to NEXUS</h1>
        <p className="mt-1 text-sm text-muted">Enter your Riot ID to build your personal dashboard.</p>
        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed) update({ myAccount: { ...parsed, platform: region }, region });
          }}
        >
          <Input wrapperClassName="flex-1" placeholder="Name#TAG" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Your Riot ID" />
          <Select className="w-full sm:w-28" label="Region" value={region} onChange={setRegion} options={REGIONS.map((r) => ({ value: r.platform, label: r.label }))} />
          <Button type="submit" variant="primary" disabled={!parsed}>
            Continue
          </Button>
        </form>
      </Card>
      <div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-2">
        <PlayersCard kind="favorites" />
        <PlayersCard kind="recent" />
      </div>
    </div>
  );
}
