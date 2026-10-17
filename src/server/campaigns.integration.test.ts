// Integración: borrado de campañas sobre la migración real (PGlite).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { checkCampaignDeletion, deleteCampaign } from "./campaigns";

type Db = Parameters<typeof deleteCampaign>[1] & object;
let d: Db;
let clientId: string;

beforeAll(async () => {
  const pg = new PGlite();
  const sql = readFileSync(new URL("../db/migrations/0000_init.sql", import.meta.url), "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
  d = drizzle(pg, { schema }) as unknown as Db;
  const [client] = await d.insert(schema.client).values({ name: "Faro", brandName: "Faro", offer: "x", icpText: "x" }).returning();
  clientId = client.id;
}, 60_000);

async function seedCampaign(name: string) {
  const [campaign] = await d
    .insert(schema.campaign)
    .values({ clientId, name, config: {}, budgetCapUsd: 10, fxCopPerUsd: 3900, weights: {}, thresholds: {} })
    .returning();
  const [lead] = await d
    .insert(schema.lead)
    .values({ campaignId: campaign.id, name: "Empresa SAS", normalizedName: "empresa", isLegalEntity: true, foundBy: ["open_data"] })
    .returning();
  await d.insert(schema.fact).values({ leadId: lead.id, text: "Hecho", source: "RUES" });
  await d.insert(schema.signal).values({ leadId: lead.id, kind: "recent_registration", evidence: "x", source: "RUES" });
  await d.insert(schema.sourceRecord).values({ leadId: lead.id, source: "rues", externalId: "1", license: "x", payload: {} });
  await d.insert(schema.activityEvent).values({ campaignId: campaign.id, kind: "done", messageKey: "activity.discoveryDone" });
  await d.insert(schema.costEvent).values({
    campaignId: campaign.id,
    kind: "llm_tokens",
    quantity: 1,
    unit: "token",
    listUnitCostUsd: 0.01,
    listAmountUsd: 0.01,
    actualAmountUsd: 0.01,
    fxCopPerUsd: 3900,
    evidence: "x",
  });
  return { campaignId: campaign.id, leadId: lead.id };
}

describe("borrado de campañas", () => {
  it("borra una campaña sin contactos con todo lo que cuelga de ella", async () => {
    const { campaignId, leadId } = await seedCampaign("Prueba");
    const keep = await seedCampaign("Otra");
    await d.insert(schema.exclusion).values({ phoneE164: "+573000000000", reason: "baja" });

    expect(await deleteCampaign(campaignId, d)).toEqual({ ok: true, deletedLeads: 1 });
    expect(await d.select().from(schema.campaign).where(eq(schema.campaign.id, campaignId))).toHaveLength(0);
    expect(await d.select().from(schema.lead).where(eq(schema.lead.id, leadId))).toHaveLength(0);
    expect(await d.select().from(schema.fact).where(eq(schema.fact.leadId, leadId))).toHaveLength(0);
    expect(await d.select().from(schema.costEvent).where(eq(schema.costEvent.campaignId, campaignId))).toHaveLength(0);
    // Las demás campañas y la lista de exclusión (global) quedan intactas.
    expect(await d.select().from(schema.lead).where(eq(schema.lead.id, keep.leadId))).toHaveLength(1);
    expect(await d.select().from(schema.exclusion)).toHaveLength(1);
  });

  it("no borra si hubo contactos o autorizaciones: la evidencia se conserva", async () => {
    const { campaignId, leadId } = await seedCampaign("Contactada");
    await d.insert(schema.contactAttempt).values({ leadId, channel: "email_simple", provider: "brevo", status: "sent" });
    expect(await checkCampaignDeletion(campaignId, d)).toMatchObject({ deletable: false, attempts: 1 });
    expect(await deleteCampaign(campaignId, d)).toEqual({ ok: false, reason: "has_contacts" });
    expect(await d.select().from(schema.campaign).where(eq(schema.campaign.id, campaignId))).toHaveLength(1);

    const other = await seedCampaign("Con autorización");
    await d.insert(schema.consent).values({ leadId: other.leadId, token: "t", phoneE164: "+573001112233", ip: "1.1.1.1", textVersion: "v1" });
    expect(await deleteCampaign(other.campaignId, d)).toEqual({ ok: false, reason: "has_contacts" });
  });

  it("campaña inexistente", async () => {
    expect(await deleteCampaign("00000000-0000-0000-0000-000000000000", d)).toEqual({ ok: false, reason: "not_found" });
  });
});
