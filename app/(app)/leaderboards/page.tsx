import { redirect } from "next/navigation";

/** Removed from NEXUS — old links go to the start page. */
export default function Page() {
  redirect("/");
}
