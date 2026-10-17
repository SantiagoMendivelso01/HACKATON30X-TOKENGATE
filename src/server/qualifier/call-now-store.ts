// Implementación con Drizzle de CallNowStore (F3).
import { and, desc, eq, gte, inArray, sum } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { CallNowStore, DiagnosticContext } from "./call-now";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export class DrizzleCallNowStore implements CallNowStore {
  constructor(private d: Db = db()) {}

  async getDiagnostic(token: string): Promise<DiagnosticContext | null> {
    const [row] = await this.d
      .select({ token: schema.diagnosticToken, lead: schema.lead, campaign: schema.campaign, client: schema.client, dossier: schema.dossier })
      .from(schema.diagnosticToken)
      .innerJoin(schema.lead, eq(schema.lead.id, schema.diagnosticToken.leadId))
      .innerJoin(schema.campaign, eq(schema.campaign.id, schema.lead.campaignId))
      .innerJoin(schema.client, eq(schema.client.id, schema.campaign.clientId))
      .leftJoin(schema.dossier, eq(schema.dossier.leadId, schema.lead.id))
      .where(eq(schema.diagnosticToken.token, token));
    if (!row) return null;
    const { dossier } = row;
    return {
      token: row.token.token,
      leadId: row.lead.id,
      expiresAt: row.token.expiresAt,
      callsToday: row.token.callsToday,
      callsDay: row.token.callsDay,
      lead: { isLegalEntity: row.lead.isLegalEntity },
      campaign: { id: row.campaign.id, paused: row.campaign.paused, budgetCapUsd: row.campaign.budgetCapUsd },
      brand: row.client.brandName,
      offer: row.client.offer,
      dossierSummary: dossier ? [dossier.lineWho, dossier.lineWhy, dossier.lineOpener].join("\n") : row.lead.name,
      language: row.client.contactLanguage,
    };
  }

  async countConsentsByIpSince(ip: string, since: Date) {
    const rows = await this.d.select({ id: schema.consent.id }).from(schema.consent).where(and(eq(schema.consent.ip, ip), gte(schema.consent.acceptedAt, since)));
    return rows.length;
  }

  async countConsentsByPhoneSince(phoneE164: string, since: Date) {
    const rows = await this.d
      .select({ id: schema.consent.id })
      .from(schema.consent)
      .where(and(eq(schema.consent.phoneE164, phoneE164), gte(schema.consent.acceptedAt, since)));
    return rows.length;
  }

  async isExcluded(phoneE164: string) {
    const rows = await this.d.select({ id: schema.exclusion.id }).from(schema.exclusion).where(eq(schema.exclusion.phoneE164, phoneE164)).limit(1);
    return rows.length > 0;
  }

  async lastContactAt(leadId: string) {
    const [row] = await this.d
      .select({ at: schema.contactAttempt.createdAt })
      .from(schema.contactAttempt)
      .where(and(eq(schema.contactAttempt.leadId, leadId), inArray(schema.contactAttempt.status, ["sent", "unconfirmed"])))
      .orderBy(desc(schema.contactAttempt.createdAt))
      .limit(1);
    return row?.at ?? null;
  }

  /** Gasto real de bolsillo (no el precio de lista) de costos variables: es lo que limita el tope. */
  async spentUsd(campaignId: string) {
    const [row] = await this.d
      .select({ total: sum(schema.costEvent.actualAmountUsd) })
      .from(schema.costEvent)
      .where(and(eq(schema.costEvent.campaignId, campaignId), eq(schema.costEvent.isFixed, false)));
    return Number(row?.total ?? 0);
  }

  async recordConsent(c: Parameters<CallNowStore["recordConsent"]>[0]) {
    await this.d.insert(schema.consent).values(c);
  }

  async bumpTokenCalls(token: string, day: string, callsToday: number) {
    await this.d.update(schema.diagnosticToken).set({ callsDay: day, callsToday }).where(eq(schema.diagnosticToken.token, token));
  }

  async createAttempt(a: { leadId: string; phoneE164: string }) {
    const [row] = await this.d
      .insert(schema.contactAttempt)
      .values({ leadId: a.leadId, channel: "voice_call_now", provider: "dapta", status: "pending", requestedByHolder: true })
      .returning({ id: schema.contactAttempt.id });
    return row.id;
  }

  async setAttempt(id: string, patch: Parameters<CallNowStore["setAttempt"]>[1]) {
    await this.d.update(schema.contactAttempt).set(patch).where(eq(schema.contactAttempt.id, id));
  }

  async logActivity(e: Parameters<CallNowStore["logActivity"]>[0]) {
    await this.d.insert(schema.activityEvent).values(e);
  }
}
