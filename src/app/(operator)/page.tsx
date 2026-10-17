import { connection } from "next/server";
import { t, type MessageKey } from "@/i18n";
import { hasDatabase } from "@/server/env";
import { loadBridge } from "@/server/lab/bridge";
import { DEFAULT_THRESHOLDS } from "@/server/lab/config";
import { ArmMatrix } from "./_components/arm-matrix";

const STATE_ICON = { working: "↻", waiting: "…", attention: "!", done: "✓" } as const;
const STATE_COLOR = { working: "text-working", waiting: "text-waiting", attention: "text-attention", done: "text-done" } as const;

export default async function BridgePage() {
  await connection();
  if (!hasDatabase()) return <Empty text={t("bridge.noDatabase")} />;
  const data = await loadBridge();
  if (!data) return <Empty text={t("bridge.noCampaign")} />;

  return (
    <main className="mx-auto w-full max-w-7xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {t("bridge.title")} · {data.campaign.name}
        </h1>
        <span className="text-sm text-muted">{t("bridge.viewVariable")}</span>
      </header>

      <section aria-labelledby="rec" className="rounded-[var(--radius)] bg-surface border border-line p-4">
        <h2 id="rec" className="text-xs uppercase tracking-wide text-muted">
          {t("bridge.recommendation")}
        </h2>
        <p className="mt-1 text-lg num">{data.recommendation.text}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="matrix">
          <h2 id="matrix" className="mb-2 text-xs uppercase tracking-wide text-muted">
            {t("bridge.matrix")}
          </h2>
          <ArmMatrix
            metrics={data.metrics}
            thompson={data.thompson}
            fx={data.campaign.fxCopPerUsd}
            minContacts={DEFAULT_THRESHOLDS.minMatureContactsForEvidence}
          />
        </section>

        <section aria-labelledby="activity">
          <h2 id="activity" className="mb-2 text-xs uppercase tracking-wide text-muted">
            {t("bridge.activity")}
          </h2>
          <ol className="space-y-1 text-sm">
            {data.activity.map((a) => (
              <li key={a.id} className={STATE_COLOR[a.kind]}>
                <span aria-hidden>{STATE_ICON[a.kind]} </span>
                <span className="sr-only">{t(`activity.${a.kind}`)}: </span>
                <span className="text-ink">{t(a.messageKey as MessageKey, a.params as Record<string, string | number> | undefined)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="pending" className="rounded-[var(--radius)] border border-line bg-surface p-4">
        <h2 id="pending" className="text-xs uppercase tracking-wide text-muted">
          {t("bridge.pending")}
        </h2>
        <p className="mt-1">{data.pendingWave ? t("bridge.reviewWave", { n: data.pendingWave.n }) : t("bridge.noPending")}</p>
      </section>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <main className="mx-auto max-w-xl p-10 text-center space-y-2">
      <h1 className="text-2xl font-semibold">{t("app.name")}</h1>
      <p className="text-muted">{t("app.tagline")}</p>
      <p className="pt-4">{text}</p>
    </main>
  );
}
