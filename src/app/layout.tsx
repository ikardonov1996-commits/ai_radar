import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { getUser } from "@/lib/session";
import { getPublicConfig } from "@/lib/config";
import { getBalances } from "@/lib/tokens";
import { AppProvider } from "@/components/AppProvider";

// Space Grotesk has no Cyrillic: Russian headings fall back to Inter (per the design system).
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-space-grotesk", display: "swap" });
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "AI Radar",
  description: "Свайпай AI-приложения и собирай свой набор",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090A",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const initialUser = user
    ? { id: user.id, email: user.email, interests: user.interests, balances: await getBalances(user.id) }
    : null;
  return (
    <html lang="ru" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        <AppProvider initialUser={initialUser} config={getPublicConfig()}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
