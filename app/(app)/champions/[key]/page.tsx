import type { Metadata } from "next";
import { ChampionDetailView } from "@/components/views/champion-detail-view";

type Params = { key: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { key } = await params;
  return { title: key.charAt(0).toUpperCase() + key.slice(1) };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { key } = await params;
  return <ChampionDetailView championKey={decodeURIComponent(key)} />;
}
