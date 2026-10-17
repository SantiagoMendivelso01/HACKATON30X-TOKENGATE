import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { t } from "@/i18n";
import { isWellFormedToken } from "@/lib/token";
import { env, hasDatabase } from "@/server/env";
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
  return (
    <main className="mx-auto w-full max-w-md" style={{ ["--brand" as string]: client.brandColor }}>
      <header className="bg-brand text-brand-ink px-5 py-4">
        <p className="text-sm font-semibold tracking-wide">{client.brandName}</p>
      </header>

      <div className="space-y-6 p-5">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight">{t("diagnostic.title", { company: lead.name })}</h1>
          <p className="text-muted">{t("diagnostic.intro", { brand: client.brandName })}</p>
        </section>

        <section aria-labelledby="facts" className="space-y-2">
          <h2 id="facts" className="font-semibold">
            {t("diagnostic.factsTitle")}
          </h2>
          {facts.length ? (
            <ul className="space-y-3">
              {facts.map((f) => (
                <li key={f.id} className="rounded-[var(--radius)] border border-line bg-surface p-3">
                  <p>{f.text}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t("diagnostic.source")}: {f.url ? <a href={f.url} className="underline" rel="nofollow noopener" target="_blank">{f.source}</a> : f.source}
                    {f.license ? ` · ${t("diagnostic.license")}: ${f.license}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t("diagnostic.noFacts")}</p>
          )}
        </section>

        <section aria-labelledby="offer" className="space-y-1">
          <h2 id="offer" className="font-semibold">
            {t("diagnostic.offerTitle")}
          </h2>
          <p>{client.offer}</p>
        </section>

        <section aria-labelledby="call" className="space-y-3 rounded-[var(--radius)] border border-line bg-surface p-4">
          <h2 id="call" className="text-lg font-semibold">
            {t("diagnostic.callTitle")}
          </h2>
          <p className="text-sm text-muted">{t("diagnostic.callHelp")}</p>
          <CallNowForm token={token} brand={client.brandName} />
        </section>

        <nav className="flex flex-col gap-3 text-center">
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="min-h-12 rounded-[var(--radius)] border border-line bg-surface py-3 font-medium">
              {t("diagnostic.whatsapp")}
            </a>
          )}
          <a href={`/baja?t=${encodeURIComponent(token)}`} className="text-sm underline text-muted py-2">
            {t("diagnostic.unsubscribe")}
          </a>
        </nav>
      </div>
    </main>
  );
}
