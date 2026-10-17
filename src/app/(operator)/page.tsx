import { connection } from "next/server";
import { t, type MessageKey } from "@/i18n";
import { hasDatabase } from "@/server/env";
import Link from "next/link";
import { listCampaigns, loadBridge, type NextAction } from "@/server/lab/bridge";
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

const UUID = /^[0-9a-f-]{36}$/i;

export default async function BridgePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await connection();
  if (!hasDatabase()) return <Empty text={t("bridge.noDatabase")} />;
  const { c } = await searchParams;
  const [data, campaigns] = await Promise.all([loadBridge(c && UUID.test(c) ? c : undefined), listCampaigns()]);
  if (!data) return <Empty text={t("bridge.noCampaign")} />;
  const { metrics, campaign } = data;
  const now = new Date();

  const leadsHref = `/leads?c=${campaign.id}`;
  const kpis = [
    { label: t("bridge.kpiFound"), value: metrics.totals.found.toLocaleString("es-CO"), href: leadsHref },
    { label: t("bridge.kpiInProfile"), value: metrics.totals.inProfile.toLocaleString("es-CO"), href: `${leadsHref}&perfil=si` },
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

      {campaigns.length > 1 && (
        <nav aria-label={t("bridge.campaigns")} className="flex flex-wrap gap-2 text-sm">
          {campaigns.map((x) => (
            <Link
              key={x.id}
              href={`/?c=${x.id}`}
              aria-current={x.id === campaign.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${x.id === campaign.id ? "border-ink bg-ink text-chrome-ink" : "border-line bg-surface"}`}
            >
              {x.name}
            </Link>
          ))}
        </nav>
      )}

      <section aria-labelledby="rec" className="rounded-[var(--radius)] bg-chrome p-6 text-chrome-ink">
        <h2 id="rec" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <span aria-hidden className="inline-block size-2 rounded-full bg-brand" />
          {t("bridge.recommendation")}
        </h2>
        <p className="mt-3 max-w-4xl font-display text-xl leading-snug font-semibold num sm:text-2xl">{data.recommendation.text}</p>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="relative rounded-[var(--radius)] border border-line bg-surface p-4 has-[a:hover]:border-ink">
            <dt className="text-xs text-muted">{k.label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold num">{k.value}</dd>
            {"href" in k && k.href && (
              <Link href={k.href} className="mt-1 inline-block text-xs font-semibold underline after:absolute after:inset-0">
                {t("bridge.seeLeads")}
              </Link>
            )}
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section aria-labelledby="matrix" className="min-w-0 rounded-[var(--radius)] border border-line bg-surface p-4">
          <h2 id="matrix" className="mb-1 px-2 text-base font-semibold">
            {t("bridge.matrix")}
          </h2>
          {metrics.totals.contacted === 0 && (
            <p className="mx-2 my-3 rounded-[var(--radius)] border border-line bg-bg p-3 text-sm">
              <span aria-hidden className="font-bold text-waiting">◌ </span>
              {t("bridge.matrixEmpty")}
            </p>
          )}
          <ArmMatrix metrics={metrics} thompson={data.thompson} fx={campaign.fxCopPerUsd} minContacts={DEFAULT_THRESHOLDS.minMatureContactsForEvidence} />
        </section>

        <div className="space-y-6">
          <section aria-labelledby="pending" className="rounded-[var(--radius)] border-2 border-ink bg-brand-soft p-4">
            <h2 id="pending" className="text-xs font-semibold uppercase tracking-wider">
              {t("bridge.pending")}
            </h2>
            <NextActionCard action={data.nextAction} leadsHref={leadsHref} />
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

function NextActionCard({ action, leadsHref }: { action: NextAction; leadsHref: string }) {
  const title =
    action.kind === "reviewWave"
      ? t("bridge.reviewWave", { n: action.n })
      : action.kind === "composingWave"
        ? t("bridge.composingWave", { n: action.n })
        : action.kind === "buildWave"
          ? t("bridge.buildWave", { n: action.n, count: Math.min(action.available, action.waveSize) })
          : action.kind === "findLeads"
            ? t("bridge.findLeads")
            : t("bridge.noPending");
  return (
    <div className="mt-1 space-y-2">
      <p className="font-display text-lg font-semibold">{title}</p>
      {action.kind === "buildWave" && (
        <>
          <p className="text-sm">{t("bridge.buildWaveHelp", { available: action.available, waveSize: action.waveSize })}</p>
          <Link href={`${leadsHref}&perfil=si`} className="inline-block rounded-[var(--radius)] bg-ink px-3 py-2 text-sm font-semibold text-chrome-ink">
            {t("bridge.seeProfileLeads")}
          </Link>
        </>
      )}
      {action.kind === "findLeads" && (
        <Link href="/campanas/nueva" className="inline-block rounded-[var(--radius)] bg-ink px-3 py-2 text-sm font-semibold text-chrome-ink">
          {t("nav.newCampaign")}
        </Link>
      )}
    </div>
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
