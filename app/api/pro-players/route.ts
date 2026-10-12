import { handle } from "@/server/http";
import { getProPlayers } from "@/server/services/pros";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => getProPlayers(), 600);
}
