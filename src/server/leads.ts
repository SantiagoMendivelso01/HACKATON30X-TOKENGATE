// Consultas de la tabla de leads y del detalle del lead (D24, D28). Solo lectura.
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { ciiuLabel } from "@/server/discovery/catalog";
import { profileMatch } from "@/server/discovery/discover";
import { campaignConfigSchema } from "@/server/lab/config";

export type ProfileFilter = "todos" | "si" | "no";

async function campaignOrLatest(campaignId?: string) {
  const d = db();
  const [c] = campaignId
    ? await d.select().from(schema.campaign).where(eq(schema.campaign.id, campaignId)).limit(1)
    : await d.select().from(schema.campaign).orderBy(desc(schema.campaign.createdAt)).limit(1);
  return c ?? null;
}

export async function listLeads(opts: { campaignId?: string; profile: ProfileFilter; q?: string }) {
  const campaign = await campaignOrLatest(opts.campaignId);
  if (!campaign) return null;
  const cfg = campaignConfigSchema.safeParse(campaign.config).data;
  const d = db();
  const q = opts.q?.trim();
  const where = and(
    eq(schema.lead.campaignId, campaign.id),
    q ? or(ilike(schema.lead.name, `%${q}%`), ilike(schema.lead.nit, `%${q}%`)) : undefined,
  );
  const all = await d.select().from(schema.lead).where(where).orderBy(desc(schema.lead.inProfile), desc(schema.lead.fitScore), asc(schema.lead.name));
  const signals = await d
    .select({ leadId: schema.signal.leadId, kind: schema.signal.kind })
    .from(schema.signal)
    .innerJoin(schema.lead, eq(schema.lead.id, schema.signal.leadId))
    .where(eq(schema.lead.campaignId, campaign.id));
  const signalsByLead = new Map<string, string[]>();
  for (const s of signals) signalsByLead.set(s.leadId, [...(signalsByLead.get(s.leadId) ?? []), s.kind]);

  const rows = all.map((l) => ({
    ...l,
    ciiuLabel: l.ciiu ? ciiuLabel(l.ciiu) : null,
    // El motivo se recalcula con la configuración guardada: misma regla que usó el descubrimiento.
    profileReason: cfg ? profileMatch(l.name, l.ciiu, l.isLegalEntity, cfg).reason : null,
    signals: signalsByLead.get(l.id) ?? [],
  }));
  const counts = { todos: rows.length, si: rows.filter((r) => r.inProfile).length, no: rows.filter((r) => !r.inProfile).length };
  const filtered = opts.profile === "todos" ? rows : rows.filter((r) => r.inProfile === (opts.profile === "si"));
  return { campaign: { id: campaign.id, name: campaign.name }, rows: filtered, counts };
}

export async function getLead(id: string) {
  const d = db();
  const [lead] = await d.select().from(schema.lead).where(eq(schema.lead.id, id)).limit(1);
  if (!lead) return null;
  const [campaign] = await d.select().from(schema.campaign).where(eq(schema.campaign.id, lead.campaignId));
  const cfg = campaignConfigSchema.safeParse(campaign.config).data;
  const [facts, signals, records, attempts, costs, dossier, outcome] = await Promise.all([
    d.select().from(schema.fact).where(eq(schema.fact.leadId, id)),
    d.select().from(schema.signal).where(eq(schema.signal.leadId, id)),
    d
      .select({ source: schema.sourceRecord.source, externalId: schema.sourceRecord.externalId, license: schema.sourceRecord.license, fetchedAt: schema.sourceRecord.fetchedAt })
      .from(schema.sourceRecord)
      .where(eq(schema.sourceRecord.leadId, id)),
    d.select().from(schema.contactAttempt).where(eq(schema.contactAttempt.leadId, id)).orderBy(desc(schema.contactAttempt.createdAt)),
    d.select().from(schema.costEvent).where(eq(schema.costEvent.leadId, id)).orderBy(asc(schema.costEvent.createdAt)),
    d.select().from(schema.dossier).where(eq(schema.dossier.leadId, id)),
    d.select().from(schema.outcome).where(eq(schema.outcome.leadId, id)),
  ]);
  return {
    lead,
    campaign: { id: campaign.id, name: campaign.name, fxCopPerUsd: campaign.fxCopPerUsd },
    ciiuLabel: lead.ciiu ? ciiuLabel(lead.ciiu) : null,
    profileReason: cfg ? profileMatch(lead.name, lead.ciiu, lead.isLegalEntity, cfg).reason : null,
    facts,
    signals,
    records,
    attempts,
    costs,
    dossier: dossier[0] ?? null,
    outcome: outcome[0] ?? null,
  };
}
