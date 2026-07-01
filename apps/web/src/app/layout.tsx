import type { Metadata } from "next";
import { Baloo_2, Quicksand } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo", weight: ["500", "600", "700"] });
const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Tina [BOT] - Panel Web",
  description: "Panneau de configuration de Tina [BOT]",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${baloo.variable} ${quicksand.variable} font-sans text-lavender-900`}>{children}</body>
    </html>
  );
}
