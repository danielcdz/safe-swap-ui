import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { ProfileScreen } from "@/components/profile/profile-screen";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your trader profile and record.",
};

export default function ProfilePage() {
  return (
    <>
      <AppHeader />
      <ProfileScreen />
    </>
  );
}
