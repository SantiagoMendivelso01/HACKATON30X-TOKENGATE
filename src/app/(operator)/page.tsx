import Link from "next/link";
import { connection } from "next/server";
import { t, type MessageKey } from "@/i18n";
import { hasDatabase } from "@/server/env";
import { listCampaigns, loadBridge, type BridgeData, type NextAction } from "@/server/lab/bridge";
import { DEFAULT_THRESHOLDS } from "@/server/lab/config";
import { formatCop } from "@/server/lab/recommendation";
import { ArmMatrix } from "./_components/arm-matrix";
import { checkCampaignDeletion } from "@/server/campaigns";
import { CampaignSwitcher } from "./_components/campaign-switcher";
import { DeleteCampaign } from "./_components/delete-campaign";
import { Help } from "./_components/help";
import { ProgressSteps } from "./_components/progress-steps";
import { relativeTime } from "./_components/relative-time";

export const metadata = { title: `${t("bridge.title")} · ${t("app.name")}` };

const STATE = {
  working: { icon: "↻", cls: "text-working" },
  waiting: { icon: "…", cls: "text-waiting" },
  attention: { icon: "!", cls: "text-attention" },
  done: { icon: "✓", cls: "text-done" },
} as const;

const UUID = /^[0-9a-f-]{36}$/i;
const btnDark = "inline-block rounded-[var(--radius)] bg-ink px-4 py-2.5 text-sm font-semibold text-chrome-ink";
const btnBrand = "inline-block rounded-[var(--radius)] bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink";

export default async function BridgePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await connection();
  if (!hasDatabase()) return <Empty text={t("bridge.noDatabase")} />;
  const { c } = await searchParams;
  const [data, campaigns] = await Promise.all([loadBridge(c && UUID.test(c) ? c : undefined), listCampaigns()]);
  if (!data) return <Empty text={t("bridge.noCampaign")} cta />;
  const { metrics, campaign } = data;
  const deletion = await checkCampaignDeletion(campaign.id);
  const now = new Date();
  const leadsHref = `/leads?c=${campaign.id}`;
  const noContacts = metrics.totals.contacted === 0;

  const kpis: { label: string; value: string; href?: string; help?: string }[] = [
    { label: t("bridge.kpiFound"), value: metrics.totals.found.toLocaleString("es-CO"), href: leadsHref },
    { label: t("bridge.kpiInProfile"), value: metrics.totals.inProfile.toLocaleString("es-CO"), href: `${leadsHref}&perfil=si`, help: t("help.inProfile") },
    { label: t("bridge.kpiContacted"), value: metrics.totals.contacted.toLocaleString("es-CO") },
    { label: t("bridge.kpiQualified"), value: metrics.totals.qualified.toLocaleString("es-CO") },
    { label: t("bridge.kpiCost"), value: formatCop(metrics.totals.costUsd * campaign.fxCopPerUsd), help: t("help.view") },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted">{t("bridge.campaign")}</p>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {campaigns.length > 1 && <CampaignSwitcher campaigns={campaigns} current={campaign.id} />}
          <Link href="/campanas/nueva" className="rounded-[var(--radius)] border border-line bg-surface px-3 py-1.5 text-sm font-medium">
            + {t("nav.newCampaign")}
          </Link>
          <DeleteCampaign campaignId={campaign.id} campaignName={campaign.name} leads={deletion.leads} deletable={deletion.deletable} />
        </div>
      </header>

      <ProgressSteps current={data.progress.current} />

      <Hero data={data} leadsHref={leadsHref} />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="relative rounded-[var(--radius)] border border-line bg-surface p-4 has-[a:hover]:border-ink">
            <dt className="flex items-center gap-1 text-xs text-muted">
              {k.label}
              {k.help && <Help text={k.help} />}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold num">{k.value}</dd>
            {k.href && (
              <Link href={k.href} className="mt-1 inline-block text-xs font-semibold underline">
                {t("bridge.seeLeads")} →
              </Link>
            )}
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section aria-labelledby="matrix" className="min-w-0 rounded-[var(--radius)] border border-line bg-surface p-4">
          <div className="mb-1 flex items-center gap-2 px-2">
            <h2 id="matrix" className="text-base font-semibold">
              {t("bridge.matrix")}
            </h2>
            <Help text={t("help.matrix")} />
          </div>
          {noContacts ? (
            <>
              <p className="mx-2 my-3 text-sm text-muted">{t("bridge.matrixEmpty")}</p>
              <details className="mx-2">
                <summary className="cursor-pointer text-sm font-semibold underline">{t("bridge.matrixPreview")}</summary>
                <div className="mt-3">
                  <MatrixLegend />
                  <ArmMatrix metrics={metrics} thompson={data.thompson} fx={campaign.fxCopPerUsd} minContacts={DEFAULT_THRESHOLDS.minMatureContactsForEvidence} />
                </div>
              </details>
            </>
          ) : (
            <>
              <MatrixLegend />
              <ArmMatrix metrics={metrics} thompson={data.thompson} fx={campaign.fxCopPerUsd} minContacts={DEFAULT_THRESHOLDS.minMatureContactsForEvidence} />
            </>
          )}
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
                  <p>{t(a.messageKey as MessageKey, a.params as Record<string, string | number> | undefined)}</p>
                  <p className="text-xs text-muted">
                    <span className={`font-semibold ${STATE[a.kind].cls}`}>{t(`activity.${a.kind}`)}</span> · {relativeTime(a.createdAt, now)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

function MatrixLegend() {
  return (
    <div className="mx-2 mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1">
        {t("bridge.cpql")} <Help text={t("help.cpql")} />
      </span>
      <span className="flex items-center gap-1">
        {t("bridge.funnel")} <Help text={t("help.funnel")} />
      </span>
      <span className="flex items-center gap-1">
        {t("bridge.pBest")} <Help text={t("help.pBest")} align="right" />
      </span>
    </div>
  );
}

/** Tarjeta protagonista: cambia según la fase para mostrar siempre lo más útil. */
function Hero({ data, leadsHref }: { data: BridgeData; leadsHref: string }) {
  const { metrics, progress, nextAction } = data;
  const base = "rounded-[var(--radius)] bg-chrome p-6 text-chrome-ink";
  const label = (text: string) => (
    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
      <span aria-hidden className="inline-block size-2 rounded-full bg-brand" />
      {text}
    </h2>
  );

  if (metrics.totals.contacted === 0) {
    return (
      <section className={base}>
        {label(t("hero.nextStep"))}
        <NextActionBody action={nextAction} leadsHref={leadsHref} />
      </section>
    );
  }
  if (data.thompson.matureContactsTotal === 0 && progress.firstMatureAt) {
    const time = progress.firstMatureAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
    return (
      <section className={base}>
        {label(t("hero.waitingTitle"))}
        <p className="mt-3 max-w-3xl font-display text-xl font-semibold">{t("hero.waitingBody", { time })}</p>
      </section>
    );
  }
  return (
    <section className={base}>
      {label(t("bridge.recommendation"))}
      <p className="mt-3 max-w-4xl font-display text-xl leading-snug font-semibold num sm:text-2xl">{data.recommendation.text}</p>
    </section>
  );
}

function NextActionBody({ action, leadsHref }: { action: NextAction; leadsHref: string }) {
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
    <div className="mt-3 space-y-3">
      <p className="font-display text-2xl leading-snug font-semibold">{title}</p>
      {action.kind === "buildWave" && <p className="max-w-3xl text-sm text-chrome-muted">{t("bridge.buildWaveHelp", { available: action.available, waveSize: action.waveSize })}</p>}
      <div className="flex flex-wrap gap-2">
        {action.kind === "buildWave" && (
          <Link href={`${leadsHref}&perfil=si`} className={btnBrand}>
            {t("bridge.seeProfileLeads")} →
          </Link>
        )}
        {action.kind === "findLeads" && (
          <Link href="/campanas/nueva" className={btnBrand}>
            {t("nav.newCampaign")} →
          </Link>
        )}
      </div>
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta?: boolean }) {
  return (
    <main className="mx-auto max-w-xl space-y-3 p-10 text-center">
      <h1 className="text-2xl font-bold">{t("app.name")}</h1>
      <p className="text-muted">{t("app.tagline")}</p>
      <p className="pt-4">{text}</p>
      {cta && (
        <Link href="/campanas/nueva" className={btnDark}>
          {t("nav.newCampaign")} →
        </Link>
      )}
    </main>
  );
}
