import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { PostAdScreen } from "@/components/ads/post-ad-screen";
import { MARKET } from "@/components/p2p/types";

export const metadata: Metadata = {
  title: "Post an ad",
  description: `Publish standing terms to buy or sell ${MARKET.asset}.`,
};

export default function PostAdPage() {
  return (
    <>
      <AppHeader />
      <PostAdScreen />
    </>
  );
}
