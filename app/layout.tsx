import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { cookies, headers } from "next/headers";
import { Providers } from "@/components/providers";
import { LANG_COOKIE, pickLang } from "@/lib/i18n-shared";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-cinzel", display: "swap" });

export const metadata: Metadata = {
  title: { default: "NEXUS — Stats Beyond The Game", template: "%s · NEXUS" },
  description: "League of Legends analytics: profiles, match history, live games, builds and tier lists.",
  applicationName: "NEXUS",
};

export const viewport: Viewport = { themeColor: "#070A13", colorScheme: "dark light" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = pickLang((await cookies()).get(LANG_COOKIE)?.value, (await headers()).get("accept-language"));
  return (
    <html lang={lang} className={`${inter.variable} ${cinzel.variable}`} suppressHydrationWarning>
      <body>
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
