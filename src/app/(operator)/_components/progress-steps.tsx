import { t } from "@/i18n";
import { STEPS, type StepKey } from "@/server/lab/bridge";

/** Indicador de fase: dónde va la campaña y qué sigue. El estado nunca depende solo del color. */
export function ProgressSteps({ current }: { current: StepKey }) {
  const idx = STEPS.indexOf(current);
  return (
    <nav aria-label={t("progress.title")}>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STEPS.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <li
              key={s}
              aria-current={state === "current" ? "step" : undefined}
              className={`flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs ${
                state === "current" ? "border-ink bg-brand text-brand-ink font-semibold" : state === "done" ? "border-line bg-surface" : "border-dashed border-line text-muted"
              }`}
            >
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  state === "done" ? "bg-ink text-chrome-ink" : state === "current" ? "bg-ink text-brand" : "border border-line"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span>
                {t(`progress.${s}`)}
                <span className="sr-only"> ({t(`progress.${state}`)})</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
