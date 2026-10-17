// Borrado de campañas. Regla de cumplimiento: solo se borran campañas SIN contactos. Si hubo intentos de
// contacto o autorizaciones ("Llámenme ahora"), esa evidencia se conserva (ADR-003: auditoría, intervalo de
// 7 días de la Ley 2300). La lista de exclusión es global y nunca se toca.
import { count, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DeletionCheck {
  exists: boolean;
  deletable: boolean;
  leads: number;
  attempts: number;
  consents: number;
}

export async function checkCampaignDeletion(campaignId: string, d: Db = db()): Promise<DeletionCheck> {
  const [campaign] = await d.select({ id: schema.campaign.id }).from(schema.campaign).where(eq(schema.campaign.id, campaignId));
  if (!campaign) return { exists: false, deletable: false, leads: 0, attempts: 0, consents: 0 };
  const leadIds = d.select({ id: schema.lead.id }).from(schema.lead).where(eq(schema.lead.campaignId, campaignId));
  const [[leads], [attempts], [consents]] = await Promise.all([
    d.select({ n: count() }).from(schema.lead).where(eq(schema.lead.campaignId, campaignId)),
    d.select({ n: count() }).from(schema.contactAttempt).where(inArray(schema.contactAttempt.leadId, leadIds)),
    d.select({ n: count() }).from(schema.consent).where(inArray(schema.consent.leadId, leadIds)),
  ]);
  return {
    exists: true,
    deletable: attempts.n === 0 && consents.n === 0,
    leads: leads.n,
    attempts: attempts.n,
    consents: consents.n,
  };
}

export type DeleteResult = { ok: true; deletedLeads: number } | { ok: false; reason: "not_found" | "has_contacts" };

export async function deleteCampaign(campaignId: string, d: Db = db()): Promise<DeleteResult> {
  return d.transaction(async (tx) => {
    const check = await checkCampaignDeletion(campaignId, tx as unknown as Db);
    if (!check.exists) return { ok: false, reason: "not_found" };
    if (!check.deletable) return { ok: false, reason: "has_contacts" };

    const leadIds = tx.select({ id: schema.lead.id }).from(schema.lead).where(eq(schema.lead.campaignId, campaignId));
    // Orden por llaves foráneas: primero lo que cuelga del lead, luego la campaña.
    for (const table of [schema.sourceRecord, schema.fact, schema.signal, schema.dossier, schema.armAssignment, schema.message, schema.outcome, schema.diagnosticToken]) {
      await tx.delete(table).where(inArray(table.leadId, leadIds));
    }
    await tx.delete(schema.llmCall).where(inArray(schema.llmCall.leadId, leadIds));
    await tx.delete(schema.costEvent).where(eq(schema.costEvent.campaignId, campaignId));
    await tx.delete(schema.activityEvent).where(eq(schema.activityEvent.campaignId, campaignId));
    await tx.delete(schema.recommendation).where(eq(schema.recommendation.campaignId, campaignId));
    await tx.delete(schema.wave).where(eq(schema.wave.campaignId, campaignId));
    await tx.delete(schema.arm).where(eq(schema.arm.campaignId, campaignId));
    await tx.delete(schema.lead).where(eq(schema.lead.campaignId, campaignId));
    await tx.delete(schema.campaign).where(eq(schema.campaign.id, campaignId));
    return { ok: true, deletedLeads: check.leads };
  });
}
