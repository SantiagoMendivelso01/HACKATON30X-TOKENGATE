import { t } from "@/i18n";

/** Ayuda contextual: un "?" que despliega la explicación en lenguaje claro. Funciona sin JS. */
export function Help({ text, align = "left" }: { text: string; align?: "left" | "right" }) {
  return (
    <details className="relative inline-block align-middle">
      <summary
        className="inline-flex size-4 cursor-pointer list-none items-center justify-center rounded-full border border-current text-[10px] leading-none font-bold text-muted [&::-webkit-details-marker]:hidden"
        aria-label={t("help.open")}
        title={t("help.open")}
      >
        ?
      </summary>
      <div
        role="note"
        className={`absolute top-6 z-20 w-64 rounded-[var(--radius)] border border-line bg-surface p-3 text-left text-xs font-normal normal-case tracking-normal text-ink shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
      >
        {text}
      </div>
    </details>
  );
}
