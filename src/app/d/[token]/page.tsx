import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { t } from "@/i18n";
import { isWellFormedToken } from "@/lib/token";
import { env, hasDatabase } from "@/server/env";
import { inkOn } from "@/theme/contrast";
import { CallNowForm } from "./call-now-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function load(token: string) {
  if (!hasDatabase() || !isWellFormedToken(token)) return null;
  const d = db();
  const [row] = await d
    .select({ token: schema.diagnosticToken, lead: schema.lead, client: schema.client })
    .from(schema.diagnosticToken)
    .innerJoin(schema.lead, eq(schema.lead.id, schema.diagnosticToken.leadId))
    .innerJoin(schema.campaign, eq(schema.campaign.id, schema.lead.campaignId))
    .innerJoin(schema.client, eq(schema.client.id, schema.campaign.clientId))
    .where(eq(schema.diagnosticToken.token, token));
  if (!row || row.token.expiresAt <= new Date()) return null;
  // Solo hechos almacenables y citados (nada de Places, que no se guarda).
  const facts = await d.select().from(schema.fact).where(eq(schema.fact.leadId, row.lead.id));
  return { ...row, facts };
}

export default async function DiagnosticPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) {
    return (
      <main className="mx-auto w-full max-w-md p-6">
        <p className="text-lg">{t("diagnostic.invalid")}</p>
      </main>
    );
  }

  const { client, lead, facts } = data;
  const whatsapp = env().WHATSAPP_NUMBER;
  // Tema por cliente (ADR-005): solo su marca.
  const brandVars = { "--brand": client.brandColor, "--brand-ink": inkOn(client.brandColor) } as React.CSSProperties;

  return (
    <div className="flex min-h-full flex-1 flex-col" style={brandVars}>
      <header className="bg-chrome text-chrome-ink">
        <div className="mx-auto w-full max-w-md px-5 pt-4 pb-8">
          <p className="flex items-center gap-2 font-display text-sm font-bold">
            <span aria-hidden className="inline-block size-2.5 rounded-[3px] bg-brand" />
            {client.brandName}
          </p>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-brand">{t("diagnostic.eyebrow")}</p>
          <h1 className="mt-1 text-2xl leading-tight font-bold">{t("diagnostic.title", { company: lead.name })}</h1>
          <p className="mt-2 text-sm text-chrome-muted">{t("diagnostic.intro", { brand: client.brandName })}</p>
        </div>
      </header>

      <main className="mx-auto -mt-4 w-full max-w-md flex-1 space-y-5 px-4 pb-8">
        <section aria-labelledby="call" className="space-y-3 rounded-[var(--radius)] border border-line bg-surface p-5 shadow-sm">
          <h2 id="call" className="text-lg font-bold">
            {t("diagnostic.callTitle")}
          </h2>
          <p className="text-sm text-muted">{t("diagnostic.callHelp")}</p>
          <CallNowForm token={token} brand={client.brandName} />
        </section>

        <section aria-labelledby="facts" className="space-y-3">
          <h2 id="facts" className="px-1 font-bold">
            {t("diagnostic.factsTitle")}
          </h2>
          {facts.length ? (
            <ul className="space-y-2">
              {facts.map((f) => (
                <li key={f.id} className="flex gap-3 rounded-[var(--radius)] border border-line bg-surface p-4">
                  <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-ink">
                    ✓
                  </span>
                  <div>
                    <p className="sr-only">{t("diagnostic.verified")}:</p>
                    <p>{f.text}</p>
                    <p className="mt-1 text-xs text-muted">
                      {t("diagnostic.source")}:{" "}
                      {f.url ? (
                        <a href={f.url} className="underline" rel="nofollow noopener" target="_blank">
                          {f.source}
                        </a>
                      ) : (
                        f.source
                      )}
                      {f.license ? ` · ${t("diagnostic.license")}: ${f.license}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-muted">{t("diagnostic.noFacts")}</p>
          )}
        </section>

        <section aria-labelledby="offer" className="rounded-[var(--radius)] bg-chrome-2 p-5 text-chrome-ink">
          <h2 id="offer" className="text-xs font-semibold uppercase tracking-wider text-brand">
            {t("diagnostic.offerTitle")}
          </h2>
          <p className="mt-2">{client.offer}</p>
        </section>

        <nav className="flex flex-col gap-2 text-center">
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="min-h-12 rounded-[var(--radius)] border border-line bg-surface py-3 font-semibold">
              {t("diagnostic.whatsapp")}
            </a>
          )}
          <a href={`/baja?t=${encodeURIComponent(token)}`} className="py-2 text-sm text-muted underline">
            {t("diagnostic.unsubscribe")}
          </a>
        </nav>
      </main>

      <footer className="border-t border-line px-5 py-4 text-center text-xs text-muted">
        {t("app.builtFor")} ·{" "}
        <a href="/privacidad" className="underline">
          {t("diagnostic.privacyLink")}
        </a>
      </footer>
    </div>
  );
}
