import type { MatchDetail, ParticipantSummary, PlayerInsight } from "@/lib/types";

/**
 * "What to improve": findings derived only from the player's own recent matches.
 * Comparisons use the lane opponent of each game (same role, other team), which is a fair
 * stand-in for "players at your rank" because matchmaking pairs similar players.
 * Texts are English templates with {placeholders}; the client translates them.
 */

const MIN_LANE_GAMES = 5;

const fmt1 = (v: number) => v.toFixed(1);
const pctStr = (v: number) => `${Math.round(v * 100)}%`;

interface LaneSample {
  me: ParticipantSummary;
  opp: ParticipantSummary;
  min: number;
}

function hourIn(ts: number, timeZone: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone }).format(new Date(ts))) % 24;
  } catch {
    return new Date(ts).getHours();
  }
}

const BUCKETS: { id: string; label: string; from: number; to: number }[] = [
  { id: "morning", label: "in the morning (6–12)", from: 6, to: 12 },
  { id: "afternoon", label: "in the afternoon (12–18)", from: 12, to: 18 },
  { id: "evening", label: "in the evening (18–22)", from: 18, to: 22 },
  { id: "night", label: "at night (22–6)", from: 22, to: 30 },
];
const bucketOf = (h: number) => BUCKETS.find((b) => (h >= b.from && h < b.to) || (h + 24 >= b.from && h + 24 < b.to))!;

export function computeInsights(matches: MatchDetail[], puuid: string, timeZone = (typeof process !== "undefined" && process.env?.TZ) || "Europe/Warsaw"): PlayerInsight[] {
  const games = matches
    .map((m) => ({ m, me: m.participants.find((p) => p.puuid === puuid) }))
    .filter((g): g is { m: MatchDetail; me: ParticipantSummary } => Boolean(g.me) && g.m.durationSec >= 600)
    .sort((a, b) => a.m.gameCreation - b.m.gameCreation);
  const out: PlayerInsight[] = [];
  if (games.length < 5) return out;

  /* ---- lane comparisons (Summoner's Rift games with a known lane opponent) */
  const lane: LaneSample[] = [];
  for (const { m, me } of games) {
    if (!me.role) continue;
    const opp = m.participants.find((p) => p.teamId !== me.teamId && p.role === me.role);
    if (opp) lane.push({ me, opp, min: m.durationSec / 60 });
  }
  const avg = (xs: LaneSample[], f: (s: LaneSample) => number) => xs.reduce((s, x) => s + f(x), 0) / Math.max(1, xs.length);

  const farmers = lane.filter((s) => s.me.role !== "UTILITY" && s.me.role !== "JUNGLE");
  if (farmers.length >= MIN_LANE_GAMES) {
    const you = avg(farmers, (s) => s.me.cs / s.min);
    const them = avg(farmers, (s) => s.opp.cs / s.min);
    const diff = you - them;
    if (diff <= -0.6)
      out.push({ id: "cs-low", tone: "bad", title: "Farming: {you} CS/min vs {them} for your lane opponents", detail: "That's about {lost} fewer minions in a 30-minute game. Practise last-hitting and keep farming side waves between fights.", vars: { you: fmt1(you), them: fmt1(them), lost: Math.round(-diff * 30) } });
    else if (diff >= 0.6) out.push({ id: "cs-high", tone: "good", title: "Farming: {you} CS/min vs {them} for your lane opponents", detail: "You out-farm your opponents — turn that gold lead into objectives.", vars: { you: fmt1(you), them: fmt1(them) } });
  }

  if (lane.length >= MIN_LANE_GAMES) {
    const youV = avg(lane, (s) => s.me.visionScore / s.min);
    const themV = avg(lane, (s) => s.opp.visionScore / s.min);
    if (youV < themV * 0.8)
      out.push({ id: "vision-low", tone: "bad", title: "Vision: {you}/min vs {them}/min for your lane opponents", detail: "Buy a Control Ward on every back and use your trinket on cooldown.", vars: { you: fmt1(youV), them: fmt1(themV) } });
    else if (youV > themV * 1.25) out.push({ id: "vision-high", tone: "good", title: "Vision: {you}/min vs {them}/min for your lane opponents", detail: "Great map control — keep warding before objectives spawn.", vars: { you: fmt1(youV), them: fmt1(themV) } });

    const youD = avg(lane, (s) => s.me.deaths);
    const themD = avg(lane, (s) => s.opp.deaths);
    if (youD - themD >= 1.5)
      out.push({ id: "deaths-high", tone: "bad", title: "Deaths: {you} per game vs {them} for your lane opponents", detail: "Dying less is the fastest way to climb. Check the minimap before pushing and respect enemy jungle timers.", vars: { you: fmt1(youD), them: fmt1(themD) } });
    else if (themD - youD >= 1.5) out.push({ id: "deaths-low", tone: "good", title: "Deaths: {you} per game vs {them} for your lane opponents", detail: "You stay alive more than your opponents — strong discipline.", vars: { you: fmt1(youD), them: fmt1(themD) } });

    const youDmg = avg(lane, (s) => s.me.damageToChampions / s.min);
    const themDmg = avg(lane, (s) => s.opp.damageToChampions / s.min);
    if (lane.filter((s) => s.me.role !== "UTILITY").length >= MIN_LANE_GAMES && youDmg < themDmg * 0.8)
      out.push({ id: "damage-low", tone: "bad", title: "Damage: {you}/min vs {them}/min for your lane opponents", detail: "Look for more trades in lane and stay in range during team fights.", vars: { you: Math.round(youDmg), them: Math.round(themDmg) } });

    const laneWins = lane.filter((s) => s.me.gold > s.opp.gold).length / lane.length;
    if (laneWins <= 0.35) out.push({ id: "gold-behind", tone: "bad", title: "You end {share} of games with less gold than your lane opponent", detail: "Focus on the first 10 minutes: CS, plates and not dying for free.", vars: { share: pctStr(1 - laneWins) } });
  }

  /* ---- kill participation */
  const kps = games.map(({ m, me }) => {
    const team = m.participants.filter((p) => p.teamId === me.teamId).reduce((s, p) => s + p.kills, 0);
    return team ? (me.kills + me.assists) / team : 0;
  });
  const kp = kps.reduce((s, x) => s + x, 0) / kps.length;
  if (kp < 0.42) out.push({ id: "kp-low", tone: "bad", title: "Kill participation {kp}", detail: "You're often away when your team fights. Group for dragons, heralds and sieges.", vars: { kp: pctStr(kp) } });

  /* ---- time of day */
  const byBucket = new Map<string, { games: number; wins: number }>();
  for (const { m, me } of games) {
    const b = bucketOf(hourIn(m.gameCreation, timeZone));
    const e = byBucket.get(b.id) ?? { games: 0, wins: 0 };
    e.games++;
    if (me.win) e.wins++;
    byBucket.set(b.id, e);
  }
  const rated = [...byBucket.entries()].filter(([, e]) => e.games >= 4).map(([id, e]) => ({ b: BUCKETS.find((x) => x.id === id)!, wr: e.wins / e.games, games: e.games }));
  if (rated.length >= 2) {
    const best = rated.reduce((x, y) => (y.wr > x.wr ? y : x));
    const worst = rated.reduce((x, y) => (y.wr < x.wr ? y : x));
    if (best.wr - worst.wr >= 0.2)
      out.push({ id: "time", tone: "info", title: "You play best {best}: {bestWr} win rate", detail: "It drops to {worstWr} {worst}. Plan ranked games for your best hours.", vars: { best: best.b.label, bestWr: pctStr(best.wr), worst: worst.b.label, worstWr: pctStr(worst.wr) } });
  }

  /* ---- tilt: results of the next game in the same session */
  let afterLoss = { games: 0, wins: 0 };
  let afterWin = { games: 0, wins: 0 };
  for (let i = 1; i < games.length; i++) {
    const prev = games[i - 1];
    const cur = games[i];
    if (cur.m.gameCreation - (prev.m.gameCreation + prev.m.durationSec * 1000) > 60 * 60_000) continue;
    const bucket = prev.me.win ? afterWin : afterLoss;
    bucket.games++;
    if (cur.me.win) bucket.wins++;
  }
  if (afterLoss.games >= 5 && afterWin.games >= 3) {
    const l = afterLoss.wins / afterLoss.games;
    const w = afterWin.wins / afterWin.games;
    if (w - l >= 0.2) out.push({ id: "tilt", tone: "bad", title: "After a loss you win only {after} of the next games", detail: "After a win it's {win}. A short break after a loss can save LP.", vars: { after: pctStr(l), win: pctStr(w) } });
  }
  afterLoss = { games: 0, wins: 0 };
  afterWin = { games: 0, wins: 0 };

  /* ---- game length */
  const short = games.filter((g) => g.m.durationSec < 25 * 60);
  const long = games.filter((g) => g.m.durationSec >= 32 * 60);
  if (short.length >= 4 && long.length >= 4) {
    const sw = short.filter((g) => g.me.win).length / short.length;
    const lw = long.filter((g) => g.me.win).length / long.length;
    if (lw - sw >= 0.25) out.push({ id: "late", tone: "info", title: "You win {long} of long games but {short} of short ones", detail: "Your strength is the late game — play safe early and scale." , vars: { long: pctStr(lw), short: pctStr(sw) } });
    else if (sw - lw >= 0.25) out.push({ id: "early", tone: "info", title: "You win {short} of short games but {long} of long ones", detail: "Press your early advantages and close games before 30 minutes.", vars: { long: pctStr(lw), short: pctStr(sw) } });
  }

  /* ---- champion pool */
  const champs = new Map<number, { name: string; games: number; wins: number }>();
  for (const { me } of games) {
    const c = champs.get(me.championId) ?? { name: me.championName, games: 0, wins: 0 };
    c.games++;
    if (me.win) c.wins++;
    champs.set(me.championId, c);
  }
  const pool = [...champs.values()].filter((c) => c.games >= 4);
  const best = pool.filter((c) => c.wins / c.games >= 0.6).sort((a, b) => b.wins / b.games - a.wins / a.games)[0];
  const worst = pool.filter((c) => c.wins / c.games <= 0.35).sort((a, b) => a.wins / a.games - b.wins / b.games)[0];
  if (best) out.push({ id: "champ-best", tone: "good", title: "{champion} is your best pick: {wr} in {games} games", detail: "Pick it more often in ranked.", vars: { champion: best.name, wr: pctStr(best.wins / best.games), games: best.games } });
  if (worst) out.push({ id: "champ-worst", tone: "bad", title: "{champion}: only {wr} in {games} games", detail: "Consider practising it in normals before playing it in ranked.", vars: { champion: worst.name, wr: pctStr(worst.wins / worst.games), games: worst.games } });

  const order = { bad: 0, info: 1, good: 2 } as const;
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
