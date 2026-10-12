import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-cinzel", display: "swap" });

export const metadata: Metadata = {
  title: { default: "NEXUS — Stats Beyond The Game", template: "%s · NEXUS" },
  description: "League of Legends analytics: profiles, match history, live games, builds and tier lists.",
  applicationName: "NEXUS",
};

export const viewport: Viewport = { themeColor: "#070A13", colorScheme: "dark light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cinzel.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
