import { t } from "@/i18n";

/** Esqueleto mientras se leen los datos: la estructura aparece al instante. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl animate-pulse space-y-6 px-6 py-6" aria-busy="true">
      <p className="sr-only" role="status">
        {t("common.loading")}
      </p>
      <div className="h-8 w-72 rounded bg-line" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-10 rounded-[var(--radius)] bg-line" />
        ))}
      </div>
      <div className="h-36 rounded-[var(--radius)] bg-chrome-2/80" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-24 rounded-[var(--radius)] bg-line" />
        ))}
      </div>
    </main>
  );
}
