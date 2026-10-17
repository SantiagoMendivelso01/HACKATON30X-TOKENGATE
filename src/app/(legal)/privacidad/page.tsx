import { t } from "@/i18n";

// Texto definitivo a cargo de la persona C (S-L: Ley 1581 y Ley 2300).
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{t("legal.privacyTitle")}</h1>
      <p className="text-attention">{t("legal.draftNotice")}</p>
    </main>
  );
}
