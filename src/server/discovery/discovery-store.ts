// Implementación con Drizzle de DiscoveryStore. Inserta en lotes; Places nunca llega aquí salvo `place_id`.
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { DiscoveredLead, DiscoveryStore } from "./discover";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export class DrizzleDiscoveryStore implements DiscoveryStore {
  constructor(private d: Db = db()) {}

  async knownKeys(campaignId: string) {
    const rows = await this.d.select({ nit: schema.lead.nit, placeId: schema.lead.placeId }).from(schema.lead).where(eq(schema.lead.campaignId, campaignId));
    return {
      nits: new Set(rows.map((r) => r.nit).filter((x): x is string => Boolean(x))),
      placeIds: new Set(rows.map((r) => r.placeId).filter((x): x is string => Boolean(x))),
    };
  }

  async save(campaignId: string, leads: DiscoveredLead[]) {
    let saved = 0;
    for (const l of leads) {
      const p = l.merged.persist;
      await this.d.transaction(async (tx) => {
        const [lead] = await tx
          .insert(schema.lead)
          .values({
            campaignId,
            nit: p.nit,
            name: p.name,
            normalizedName: p.normalizedName,
            city: p.city,
            ciiu: p.ciiu,
            domain: p.domain,
            phoneE164: p.phoneE164,
            email: p.email,
            isLegalEntity: p.isLegalEntity,
            fitScore: l.fitScore,
            inProfile: l.inProfile,
            foundBy: l.merged.foundBy,
            // Si solo una fuente lo encontró, la fuente del experimento ya está decidida (D17).
            assignedSource: l.merged.foundBy.length === 1 ? l.merged.foundBy[0] : null,
            placeId: p.placeId,
          })
          .returning({ id: schema.lead.id });
        if (l.facts.length) await tx.insert(schema.fact).values(l.facts.map((f) => ({ ...f, leadId: lead.id })));
        if (l.signals.length) await tx.insert(schema.signal).values(l.signals.map((s) => ({ ...s, leadId: lead.id })));
        if (l.sourceRecords.length) await tx.insert(schema.sourceRecord).values(l.sourceRecords.map((r) => ({ ...r, leadId: lead.id })));
      });
      saved++;
    }
    return saved;
  }

  async logActivity(campaignId: string, messageKey: string, params: Record<string, unknown>, kind: "working" | "done" | "attention" = "done") {
    const [row] = await this.d.insert(schema.activityEvent).values({ campaignId, kind, messageKey, params }).returning({ id: schema.activityEvent.id });
    return row.id;
  }

  async setActivityKind(id: string, kind: "done" | "attention") {
    await this.d.update(schema.activityEvent).set({ kind }).where(eq(schema.activityEvent.id, id));
  }
}
