import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Baselings",
  description: "Hatch eggs, feed baselings, grow your POOP garden. Tamagotchi meets DeFi on Base.",
  openGraph: {
    title: "Baselings",
    description: "Hatch eggs, feed baselings, grow your POOP garden. Tamagotchi meets DeFi on Base.",
    images: ["/sprites/egg-store.png"],
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": "https://tales-of-tasern.vercel.app/sprites/egg-store.png",
    "fc:frame:button:1": "Play Baselings",
    "fc:frame:button:1:action": "launch_frame",
    "fc:frame:button:1:target": "https://tales-of-tasern.vercel.app/baselings",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function BaselingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ margin: 0, padding: 0, overflow: "hidden", background: "#000" }}>
      {children}
    </div>
  );
}
