"use client";

import { Search, Star, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile } from "@/lib/queries";
import { parseRiotId, REGIONS, regionLabel, resolveRegion, type Platform } from "@/lib/regions";
import { useSettings, type PlayerRef } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { ProfileIcon } from "../game/icons";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

/** Player chosen through ?player=Name#TAG&region=euw1, falling back to the user's own account. */
export function usePlayerParam(prefix = ""): [PlayerRef | null, (p: PlayerRef) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useSettings();
  const raw = params?.get(`${prefix}player`);
  const id = raw ? parseRiotId(raw) : null;
  const region = resolveRegion(params?.get(`${prefix}region`))?.platform ?? settings.region;
  const player: PlayerRef | null = id ? { ...id, platform: region } : prefix ? null : settings.myAccount;
  const set = (p: PlayerRef) => {
    const next = new URLSearchParams(params?.toString());
    next.set(`${prefix}player`, `${p.gameName}#${p.tagLine}`);
    next.set(`${prefix}region`, p.platform);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  return [player, set];
}

export function PlayerPicker({ player, onChange, label = "Player", className }: { player: PlayerRef | null; onChange: (p: PlayerRef) => void; label?: string; className?: string }) {
  const { settings } = useSettings();
  const [value, setValue] = useState(player ? `${player.gameName}#${player.tagLine}` : "");
  const [region, setRegion] = useState<Platform>(player?.platform ?? settings.region);
  useEffect(() => {
    if (player) {
      setValue(`${player.gameName}#${player.tagLine}`);
      setRegion(player.platform);
    }
  }, [player?.gameName, player?.tagLine, player?.platform]); // eslint-disable-line react-hooks/exhaustive-deps
  const parsed = parseRiotId(value);
  const profile = useProfile(player);
  const quick = [settings.myAccount, ...settings.favorites].filter(Boolean) as PlayerRef[];

  return (
    <Card className={cn("flex flex-wrap items-center gap-3 p-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 place-items-center overflow-hidden rounded-xl border border-primary/40 bg-primary-soft">
          {profile.data ? <ProfileIcon id={profile.data.data.account.profileIconId} size={44} /> : <UserRound className="size-5 text-primary" />}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-dim">{label}</p>
          <p className="truncate font-semibold text-fg">
            {player ? (
              <>
                {player.gameName}
                <span className="text-muted">#{player.tagLine}</span> <span className="text-xs text-dim">{regionLabel(player.platform)}</span>
              </>
            ) : (
              <span className="text-muted">No player selected</span>
            )}
          </p>
        </div>
      </div>
      <form
        className="ml-auto flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed) onChange({ ...parsed, platform: region });
        }}
      >
        <Input wrapperClassName="w-[220px]" icon={<Search />} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Name#TAG" aria-label={`${label} Riot ID`} aria-invalid={value.length > 0 && !parsed} />
        <Select className="w-[92px]" label={`${label} region`} value={region} onChange={setRegion} options={REGIONS.map((r) => ({ value: r.platform, label: r.label }))} />
        <Button type="submit" variant="primary" disabled={!parsed}>
          Load
        </Button>
        {quick.length > 0 && (
          <div className="flex items-center gap-1.5 pl-1">
            {quick.slice(0, 4).map((p) => (
              <button
                type="button"
                key={`${p.gameName}#${p.tagLine}`}
                onClick={() => onChange(p)}
                title={`${p.gameName}#${p.tagLine}`}
                className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-primary/50 hover:text-fg"
              >
                {p === settings.myAccount ? <UserRound className="size-3" /> : <Star className="size-3 text-warning" />}
                {p.gameName}
              </button>
            ))}
          </div>
        )}
      </form>
    </Card>
  );
}
