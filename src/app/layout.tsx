import type { Metadata } from "next";
import { t } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mt-auto px-6 py-3 text-xs text-muted border-t border-line">{t("app.builtFor")}</footer>
      </body>
    </html>
  );
}
