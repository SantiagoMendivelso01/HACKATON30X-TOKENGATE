import type { Metadata } from "next";
import { DM_Sans, Poppins } from "next/font/google";
import { t } from "@/i18n";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
