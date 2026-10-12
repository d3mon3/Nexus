import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output lets the Electron shell boot the server without node_modules.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "ddragon.leagueoflegends.com" },
      { protocol: "https", hostname: "raw.communitydragon.org" },
    ],
  },
  serverExternalPackages: ["@prisma/client"],
  // Type and lint checks run separately (`npm run typecheck`, `npm run lint`) so a style nit
  // can never block a server install or an .exe build.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
