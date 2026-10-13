/**
 * Translation core (no React, no "use client"), shared by client components and helpers
 * such as lib/format.ts. English strings are the keys; Polish lives in lib/i18n/pl.ts.
 */
import { DEFAULT_LANG, type Lang } from "./i18n-shared";
import { PL, PL_PLURAL } from "./i18n/pl";

let current: Lang = DEFAULT_LANG;
export const getLang = () => current;
export function setLang(l: Lang) {
  current = l;
}

type Vars = Record<string, string | number> | (string | number)[];

const interpolate = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => String((vars as Record<string, string | number>)[k] ?? m)) : s);

/** Keys with {placeholders} also translate dynamic strings (e.g. notes from the server). */
let patterns: { re: RegExp; names: string[]; pl: string }[] | null = null;
function patternTranslate(s: string): string | null {
  patterns ??= Object.entries(PL)
    .filter(([k]) => /\{\w+\}/.test(k))
    .map(([k, pl]) => {
      const names: string[] = [];
      const src = k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{(\w+)\\?\}/g, (_, n) => {
        names.push(n);
        return "(.+?)";
      });
      return { re: new RegExp(`^${src}$`), names, pl };
    });
  for (const p of patterns) {
    const m = p.re.exec(s);
    if (m) return p.pl.replace(/\{(\w+)\}/g, (_, n) => m[p.names.indexOf(n) + 1] ?? "");
  }
  return null;
}

export function t<T>(key: T, vars?: Vars): T {
  if (typeof key !== "string") return key;
  if (current === "en" || !key) return interpolate(key, vars) as T;
  const plural = vars ? PL_PLURAL[key] : undefined;
  if (plural) {
    const n = Number((vars as Record<string, string | number>)[plural.n]);
    const form = n === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 1 : 2;
    return interpolate(plural.forms[form], vars) as T;
  }
  const direct = PL[key] ?? PL[key.trim()];
  if (direct != null) return interpolate(direct, vars) as T;
  if (!vars) {
    const p = patternTranslate(key);
    if (p != null) return p as T;
  }
  return interpolate(key, vars) as T;
}

