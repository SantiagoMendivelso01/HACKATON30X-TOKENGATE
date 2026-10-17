import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { t } from "@/i18n";
import { hasDatabase } from "@/server/env";
import { getLead } from "@/server/leads";
import { formatCop } from "@/server/lab/recommendation";

const UUID = /^[0-9a-f-]{36}$/i;

export const metadata = { title: `${t("leads.detailTitle")} · ${t("app.name")}` };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-[var(--radius)] border border-line bg-surface p-5">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!hasDatabase() || !UUID.test(id)) notFound();
  const data = await getLead(id);
  if (!data) notFound();
  const { lead, campaign } = data;
  const totalUsd = data.costs.reduce((s, c) => s + c.listAmountUsd, 0);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-6 py-6">
      <Link href={`/leads?c=${campaign.id}`} className="text-sm underline">
        ← {t("leads.back")}
      </Link>

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted">{campaign.name}</p>
        <h1 className="text-2xl font-bold">{lead.name}</h1>
        <p className={`text-sm font-semibold ${lead.inProfile ? "text-done" : "text-off"}`}>
          <span aria-hidden>{lead.inProfile ? "✓ " : "— "}</span>
          {t("leads.colProfile")}: {lead.inProfile ? t("leads.inProfile") : t("leads.outProfile")}
          {data.profileReason && <span className="font-normal text-muted"> · {t("leads.why")}: {data.profileReason}</span>}
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title={t("leads.colContact")}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">{t("leads.nit")}</dt>
            <dd className="num">{lead.nit ?? "—"}</dd>
            <dt className="text-muted">{t("leads.colActivity")}</dt>
            <dd>
              <span className="num">{lead.ciiu ?? "—"}</span> {data.ciiuLabel ?? ""}
            </dd>
            <dt className="text-muted">{t("leads.city")}</dt>
            <dd>{lead.city ?? "—"}</dd>
            <dt className="text-muted">{t("leads.email")}</dt>
            <dd>{lead.email ?? "—"}</dd>
            <dt className="text-muted">{t("leads.phone")}</dt>
            <dd className="num">{lead.phoneE164 ?? "—"}</dd>
            <dt className="text-muted">{t("leads.web")}</dt>
            <dd>{lead.domain ?? "—"}</dd>
            <dt className="text-muted">{t("leads.colSource")}</dt>
            <dd>{lead.foundBy.map((s) => t(`source.${s}`)).join(" + ")}</dd>
            <dt className="text-muted">{t("leads.colFit")}</dt>
            <dd className="num font-semibold">{lead.fitScore ?? "—"}</dd>
          </dl>
          {lead.placeId && <p className="text-xs text-muted">{t("leads.placeLive")}</p>}
        </Card>

        <Card title={t("leads.dossier")}>
          {data.dossier ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>{data.dossier.lineWho}</li>
              <li>{data.dossier.lineWhy}</li>
              <li>{data.dossier.lineOpener}</li>
            </ol>
          ) : (
            <p className="text-sm text-muted">{t("leads.dossierPending")}</p>
          )}
        </Card>
      </div>

      <Card title={t("leads.facts")}>
        {data.facts.length ? (
          <ul className="space-y-2 text-sm">
            {data.facts.map((f) => (
              <li key={f.id} className="flex gap-3">
                <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-ink">
                  ✓
                </span>
                <div>
                  <p>{f.text}</p>
                  <p className="text-xs text-muted">
                    {f.url ? (
                      <a href={f.url} className="underline" rel="nofollow noopener" target="_blank">
                        {f.source}
                      </a>
                    ) : (
                      f.source
                    )}
                    {f.license ? ` · ${t("leads.license")}: ${f.license}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("leads.noFacts")}</p>
        )}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title={t("leads.signals")}>
          {data.signals.length ? (
            <ul className="space-y-1 text-sm">
              {data.signals.map((s) => (
                <li key={s.id}>
                  <span className="font-semibold">{s.kind === "recent_registration" ? t("leads.recentRegistration") : t("leads.webChat")}</span>
                  <span className="text-muted"> · {s.evidence} · {s.source}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("leads.noSignals")}</p>
          )}
        </Card>

        <Card title={t("leads.records")}>
          <ul className="space-y-1 text-sm">
            {data.records.map((r) => (
              <li key={`${r.source}:${r.externalId}`}>
                <span className="font-semibold uppercase">{r.source}</span> <span className="num text-muted">{r.externalId}</span>
                <p className="text-xs text-muted">
                  {t("leads.license")}: {r.license}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={t("leads.history")}>
        {data.attempts.length ? (
          <ul className="space-y-1 text-sm">
            {data.attempts.map((a) => (
              <li key={a.id}>
                <span className="font-semibold">{a.channel}</span> · {a.provider} · {a.status}
                <span className="text-muted"> · {a.createdAt.toLocaleString("es-CO", { timeZone: "America/Bogota" })}</span>
                {a.blockedReason && <span className="text-attention"> · {a.blockedReason}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("leads.noHistory")}</p>
        )}
      </Card>

      <Card title={t("leads.receipt")}>
        {data.costs.length ? (
          <table className="w-full text-sm">
            <tbody className="num">
              {data.costs.map((c) => (
                <tr key={c.id} className="border-b border-line">
                  <td className="py-1.5 pr-3">{c.evidence}</td>
                  <td className="py-1.5 text-right">{formatCop(c.listAmountUsd * campaign.fxCopPerUsd)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-1.5 pr-3">{t("leads.total")}</td>
                <td className="py-1.5 text-right">{formatCop(totalUsd * campaign.fxCopPerUsd)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">{t("leads.noCosts")}</p>
        )}
      </Card>
    </main>
  );
}
