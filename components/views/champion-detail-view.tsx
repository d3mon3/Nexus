"use client";


import { t } from "@/lib/i18n";
import { motion } from "framer-motion";
import { ArrowLeft, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { asset } from "@/lib/assets";
import { formatKda, pct, ROLE_LABEL, wrColor } from "@/lib/format";
import { useChampionDetail, useChampionStats } from "@/lib/queries";
import { useSettings } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BuildPanel } from "../builds/build-panel";
import { GameImage } from "../game/game-image";
import { RoleIcon } from "../game/role-icon";
import { SourceBadge } from "../game/source-badge";
import { TierBadge } from "../game/tier-badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/states";
import { Segmented } from "../ui/tabs";
import { Select } from "../ui/select";
import { Tooltip } from "../ui/tooltip";

export function ChampionDetailView({ championKey }: { championKey: string }) {
  const { findChampion } = useStatic();
  const c = findChampion(championKey);
  const { settings, toggleFavoriteChampion } = useSettings();
  const [role, setRole] = useState<Role | null>(null);
  const [patch, setPatch] = useState<string | undefined>();
  const stats = useChampionStats({ patch });
  const detail = useChampionDetail(c?.key);

  if (!c)
    return (
      <Card>
        <EmptyState
          title={t("Champion not found")}
          description={t("No champion called “{0}”.", [championKey])}
          action={
            <Link href="/champions">
              <Button size="sm" variant="outline">{t("All champions")}</Button>
            </Link>
          }
        />
      </Card>
    );

  const rows = stats.data?.data.rows.filter((r) => r.championId === c.id) ?? [];
  const activeRole = role ?? rows.sort((a, b) => b.games - a.games)[0]?.role ?? c.roles[0];
  const s = rows.find((r) => r.role === activeRole);
  const fav = settings.favoriteChampions.includes(c.id);

  return (
    <div className="space-y-3">
      <Card className="relative overflow-hidden">
        <motion.div initial={{ scale: 1.05, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8 }} className="absolute inset-0">
          <GameImage src={asset.championSplash(c.key)} alt="" className="h-full w-full object-[60%_20%] text-6xl" loading="eager" />
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0b1020_20%,rgba(11,16,32,0.6)_55%,rgba(40,20,90,0.3)),linear-gradient(0deg,#0d1324,transparent_60%)] light:bg-[linear-gradient(90deg,#fff_25%,rgba(255,255,255,0.6))]" />
        <div className="relative flex min-h-[260px] flex-col justify-end gap-4 p-6">
          <Link href="/champions" className="absolute left-5 top-5 flex items-center gap-1 text-sm text-muted hover:text-fg">
            <ArrowLeft className="size-4" />{" " + t("Champions")}</Link>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <h1 className="font-display text-5xl font-bold text-white text-glow light:text-fg">{c.name}</h1>
              <p className="mt-1 text-lg capitalize text-white/75 light:text-muted">{t(c.title) || t(detail.data?.title)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(detail.data?.tags ?? c.tags).map((tt) => (
                  <span key={tt} className="rounded-full border border-white/15 bg-black/30 px-2.5 py-0.5 text-xs text-white/80">
                    {tt}
                  </span>
                ))}
              </div>
            </div>
            {s && (
              <div className="flex items-center gap-6 rounded-xl border border-white/10 bg-black/35 px-5 py-3 backdrop-blur">
                <div className="text-center">
                  <TierBadge tier={s.tier} size="lg" />
                </div>
                {[
                  ["Win Rate", <span key="w" className={wrColor(s.winRate)}>{pct(s.winRate, 1)}</span>],
                  ["Pick Rate", pct(s.pickRate, 1)],
                  ["Ban Rate", pct(s.banRate, 1)],
                  ["KDA", formatKda(s.kda)],
                  ["Games", s.games.toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label as string} className="text-center">
                    <p className="text-lg font-bold tabular text-white light:text-fg">{value}</p>
                    <p className="text-[11px] text-white/60 light:text-muted">{label}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <SourceBadge source={stats.data?.source} note={t(stats.data?.note)} />
            </div>
          </div>
          {detail.data?.spells.length ? (
            <div className="flex flex-wrap gap-2">
              {detail.data.passive && (
                <Tooltip content={t("Passive — {0}", [detail.data.passive.name])}>
                  <GameImage src={detail.data.passive.image} alt={detail.data.passive.name} className="size-11 rounded-xl border border-white/15" />
                </Tooltip>
              )}
              {detail.data.spells.map((sp) => (
                <Tooltip key={sp.slot} content={`${sp.slot} — ${sp.name}`}>
                  <span className="relative">
                    <GameImage src={sp.image} alt={sp.name} fallbackText={sp.slot} className="size-11 rounded-xl border border-white/15" />
                    <span className="absolute -bottom-1 -right-1 rounded bg-black/80 px-1 text-[10px] font-bold text-white">{sp.slot}</span>
                  </span>
                </Tooltip>
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {c.roles.length > 1 || rows.length > 1 ? (
          <Segmented
            label={t("Role")}
            value={activeRole}
            onChange={(r) => setRole(r)}
            items={(rows.length ? rows.map((r) => r.role) : c.roles).map((r) => ({ value: r, label: <><RoleIcon role={r} size={13} /> {t(ROLE_LABEL[r])}</> }))}
          />
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <RoleIcon role={activeRole} size={15} /> {t(ROLE_LABEL[activeRole])}
          </span>
        )}
        {stats.data && (
          <Select className="ml-auto w-[132px]" label={t("Patch")} value={stats.data.data.patch} onChange={setPatch} options={stats.data.data.patches.map((p) => ({ value: p, label: t("Patch {0}", [p]) }))} />
        )}
      </div>

      <BuildPanel championId={c.id} role={activeRole} patch={stats.data?.data.patch} onRoleChange={setRole} showHeader={false} />

      {detail.data?.lore && (
        <Card className="p-5">
          <h2 className="mb-2 font-semibold">{t("Lore")}</h2>
          <p className="text-sm leading-relaxed text-muted">{detail.data.lore}</p>
        </Card>
      )}
    </div>
  );
}
