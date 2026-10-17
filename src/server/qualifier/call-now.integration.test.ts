// Integración: migración SQL real + DrizzleCallNowStore sobre PGlite (Postgres en proceso).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { newDiagnosticToken } from "@/lib/token";
import { requestCallNow } from "./call-now";
import { DrizzleCallNowStore, type Db } from "./call-now-store";
import { FakeQualifier } from "./fake";

const bog = (iso: string) => new Date(`${iso}-05:00`);
let d: Db;
const token = newDiagnosticToken();
let leadId: string;

beforeAll(async () => {
  const pg = new PGlite();
  const sql = readFileSync(new URL("../../db/migrations/0000_init.sql", import.meta.url), "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
  d = drizzle(pg, { schema }) as unknown as Db;

  const [client] = await d.insert(schema.client).values({ name: "Faro", brandName: "Faro", offer: "Diagnóstico gratuito", icpText: "Clínicas" }).returning();
  const [campaign] = await d
    .insert(schema.campaign)
    .values({ clientId: client.id, name: "Clínicas Bogotá", config: {}, budgetCapUsd: 20, fxCopPerUsd: 4000, weights: {}, thresholds: {} })
    .returning();
  const [lead] = await d
    .insert(schema.lead)
    .values({ campaignId: campaign.id, name: "Sonrisa SAS", normalizedName: "sonrisa", isLegalEntity: true, foundBy: ["open_data"], nit: "900430348" })
    .returning();
  leadId = lead.id;
  await d.insert(schema.diagnosticToken).values({ token, leadId, expiresAt: bog("2026-10-25T00:00:00") });
}, 60_000);

describe("Llámenme ahora contra Postgres", () => {
  it("registra consentimiento, intento sin confirmar, contador y actividad", async () => {
    const qualifier = new FakeQualifier();
    const store = new DrizzleCallNowStore(d);
    const r = await requestCallNow({ store, qualifier, now: bog("2026-10-17T10:00:00") }, { token, phone: "3001112233", consent: true, ip: "190.1.1.1" });
    expect(r.ok).toBe(true);
    expect(qualifier.calls[0].input.vars.brand).toBe("Faro");

    const consents = await d.select().from(schema.consent).where(eq(schema.consent.leadId, leadId));
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({ phoneE164: "+573001112233", ip: "190.1.1.1" });
    const [attempt] = await d.select().from(schema.contactAttempt).where(eq(schema.contactAttempt.leadId, leadId));
    expect(attempt).toMatchObject({ status: "unconfirmed", requestedByHolder: true, provider: "dapta" });
    const [tok] = await d.select().from(schema.diagnosticToken).where(eq(schema.diagnosticToken.token, token));
    expect(tok).toMatchObject({ callsToday: 1, callsDay: "2026-10-17" });
    const activity = await d.select().from(schema.activityEvent);
    expect(activity.at(-1)).toMatchObject({ kind: "waiting", messageKey: "activity.waitingDapta" });
  });

  it("aplica el límite por número con los consentimientos guardados", async () => {
    const store = new DrizzleCallNowStore(d);
    const q = new FakeQualifier();
    const now = bog("2026-10-17T10:30:00");
    await requestCallNow({ store, qualifier: q, now }, { token, phone: "3001112233", consent: true, ip: "10.0.0.2" });
    const third = await requestCallNow({ store, qualifier: q, now }, { token, phone: "3001112233", consent: true, ip: "10.0.0.3" });
    expect(third).toMatchObject({ ok: false });
  });

  it("respeta la lista de exclusión y el tope con gasto real", async () => {
    const store = new DrizzleCallNowStore(d);
    await d.insert(schema.exclusion).values({ phoneE164: "+573009990000", reason: "baja" });
    expect(await store.isExcluded("+573009990000")).toBe(true);
    expect(await store.spentUsd((await d.select().from(schema.campaign))[0].id)).toBe(0);
  });
});
