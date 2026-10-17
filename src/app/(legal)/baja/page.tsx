import { t } from "@/i18n";

// Baja en un clic: el formulario que escribe en `exclusion` llega con el módulo de mensajería.
export default function UnsubscribePage() {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{t("legal.unsubscribeTitle")}</h1>
      <p className="text-attention">{t("legal.draftNotice")}</p>
    </main>
  );
}
