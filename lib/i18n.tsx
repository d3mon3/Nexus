"use client";

import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Tiny i18n: English source strings are the keys, Polish comes from lib/i18n/pl.ts.
 * `t()` is a plain function (usable in render, event handlers and helpers); the provider
 * remounts the tree when the language changes. Unknown strings fall back to English,
 * and non-strings pass through unchanged, so wrapping a value is always safe.
 */
import { DEFAULT_LANG, LANG_COOKIE, type Lang } from "./i18n-shared";
import { setLang, t } from "./i18n-core";
export { getLang, setLang, t } from "./i18n-core";
export { DEFAULT_LANG, LANG_COOKIE, LANGS, type Lang } from "./i18n-shared";

export const useT = () => t;

const LangContext = createContext<{ lang: Lang; setLanguage: (l: Lang) => void }>({ lang: DEFAULT_LANG, setLanguage: () => undefined });
export const useLanguage = () => useContext(LangContext);

export function LangProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLanguage] = useState<Lang>(initial);
  return (
    <LangContext.Provider value={{ lang, setLanguage }}>
      <LangGate lang={lang}>{children}</LangGate>
    </LangContext.Provider>
  );
}

/** Sets the active language before children render and remounts them when it changes. */
function LangGate({ lang, children }: { lang: Lang; children: ReactNode }) {
  setLang(lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies blocked — the language still works for this visit */
    }
  }, [lang]);
  return <Fragment key={lang}>{children}</Fragment>;
}
