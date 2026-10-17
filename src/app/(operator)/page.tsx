import { connection } from "next/server";
import { t, type MessageKey } from "@/i18n";
import { hasDatabase } from "@/server/env";
import { loadBridge } from "@/server/lab/bridge";
import { DEFAULT_THRESHOLDS } from "@/server/lab/config";
import { formatCop } from "@/server/lab/recommendation";
import { ArmMatrix } from "./_components/arm-matrix";
import { relativeTime } from "./_components/relative-time";

const STATE = {
  working: { icon: "↻", cls: "text-working" },
  waiting: { icon: "…", cls: "text-waiting" },
  attention: { icon: "!", cls: "text-attention" },
  done: { icon: "✓", cls: "text-done" },
} as const;

export default async function BridgePage() {
  await connection();
  if (!hasDatabase()) return <Empty text={t("bridge.noDatabase")} />;
  const data = await loadBridge();
  if (!data) return <Empty text={t("bridge.noCampaign")} />;
  const { metrics, campaign } = data;
  const now = new Date();

  const kpis = [
    { label: t("bridge.kpiFound"), value: metrics.totals.found.toLocaleString("es-CO") },
    { label: t("bridge.kpiInProfile"), value: metrics.totals.inProfile.toLocaleString("es-CO") },
    { label: t("bridge.kpiContacted"), value: metrics.totals.contacted.toLocaleString("es-CO") },
    { label: t("bridge.kpiQualified"), value: metrics.totals.qualified.toLocaleString("es-CO") },
    { label: t("bridge.kpiCost"), value: formatCop(metrics.totals.costUsd * campaign.fxCopPerUsd) },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{t("bridge.campaign")}</p>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
        </div>
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">{t("bridge.viewVariable")}</span>
      </div>

      <section aria-labelledby="rec" className="rounded-[var(--radius)] bg-chrome p-6 text-chrome-ink">
        <h2 id="rec" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <span aria-hidden className="inline-block size-2 rounded-full bg-brand" />
          {t("bridge.recommendation")}
        </h2>
        <p className="mt-3 max-w-4xl font-display text-xl leading-snug font-semibold num sm:text-2xl">{data.recommendation.text}</p>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[var(--radius)] border border-line bg-surface p-4">
            <dt className="text-xs text-muted">{k.label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold num">{k.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section aria-labelledby="matrix" className="min-w-0 rounded-[var(--radius)] border border-line bg-surface p-4">
          <h2 id="matrix" className="mb-1 px-2 text-base font-semibold">
            {t("bridge.matrix")}
          </h2>
          <ArmMatrix metrics={metrics} thompson={data.thompson} fx={campaign.fxCopPerUsd} minContacts={DEFAULT_THRESHOLDS.minMatureContactsForEvidence} />
        </section>

        <div className="space-y-6">
          <section aria-labelledby="pending" className="rounded-[var(--radius)] border-2 border-ink bg-brand-soft p-4">
            <h2 id="pending" className="text-xs font-semibold uppercase tracking-wider">
              {t("bridge.pending")}
            </h2>
            <p className="mt-1 font-display text-lg font-semibold">
              {data.pendingWave ? t("bridge.reviewWave", { n: data.pendingWave.n }) : t("bridge.noPending")}
            </p>
          </section>

          <section aria-labelledby="activity" className="rounded-[var(--radius)] border border-line bg-surface p-4">
            <h2 id="activity" className="mb-3 text-base font-semibold">
              {t("bridge.activity")}
            </h2>
            <ol className="space-y-3 text-sm">
              {data.activity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span aria-hidden className={`mt-0.5 w-4 shrink-0 text-center font-bold ${STATE[a.kind].cls}`}>
                    {STATE[a.kind].icon}
                  </span>
                  <div>
                    <p>
                      <span className={`sr-only`}>{t(`activity.${a.kind}`)}: </span>
                      {t(a.messageKey as MessageKey, a.params as Record<string, string | number> | undefined)}
                    </p>
                    <p className="text-xs text-muted">
                      <span className={`font-semibold ${STATE[a.kind].cls}`}>{t(`activity.${a.kind}`)}</span> · {relativeTime(a.createdAt, now)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <main className="mx-auto max-w-xl space-y-2 p-10 text-center">
      <h1 className="text-2xl font-bold">{t("app.name")}</h1>
      <p className="text-muted">{t("app.tagline")}</p>
      <p className="pt-4">{text}</p>
    </main>
  );
}
