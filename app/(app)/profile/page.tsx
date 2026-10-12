import { Suspense } from "react";
import { ProfileLanding } from "@/components/views/player-profile-page";

export const metadata = { title: "Profile" };

export default function ProfileIndexPage() {
  return (
    <Suspense>
      <ProfileLanding />
    </Suspense>
  );
}
