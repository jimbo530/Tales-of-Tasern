import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tales of Tasern",
  description: "Champions of the Realm — on-chain backed NFT card battle game on Base | memefortrees.com",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
