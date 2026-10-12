import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayerProfilePage } from "@/components/views/player-profile-page";

type Params = { region: string; riotId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { riotId } = await params;
  return { title: decodeURIComponent(riotId).replace(/-([^-]+)$/, "#$1") };
}

export default async function ProfilePage({ params }: { params: Promise<Params> }) {
  const { region, riotId } = await params;
  return (
    <Suspense>
      <PlayerProfilePage region={region} riotId={riotId} />
    </Suspense>
  );
}
