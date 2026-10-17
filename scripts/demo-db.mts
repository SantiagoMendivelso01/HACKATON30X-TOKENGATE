// Base local de DEMO: Postgres embebido (PGlite) servido por TCP, con la migración real y datos
// de ejemplo ficticios. Solo para ver la app en localhost sin Supabase. Nunca para producción.
//
//   pnpm db:demo      → postgres://postgres:postgres@127.0.0.1:54329/postgres
//
// Los datos se guardan en .demo-db/ (ignorada por git) y sobreviven a los reinicios.
//   pnpm db:demo -- --reset   → borra y vuelve a sembrar desde cero
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/schema.ts";

const PORT = Number(process.env.DEMO_DB_PORT ?? 54329);
export const DEMO_TOKEN = "DemoDiagnosticoFaro001"; // 22 caracteres, formato de token válido
const FX = 3900; // TRM de ejemplo para la demo, no la del día

const DATA_DIR = new URL("../.demo-db/", import.meta.url);
if (process.argv.includes("--reset") && existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
const fresh = !existsSync(DATA_DIR);
const pg = await PGlite.create(fileURLToPath(DATA_DIR));
if (fresh) {
  const sql = readFileSync(new URL("../src/db/migrations/0000_init.sql", import.meta.url), "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
}
const db = drizzle(pg, { schema });

// Solo se siembra la primera vez (o con --reset).
seed: {
if (!fresh) break seed;

// PRNG determinista: la demo es igual en cada arranque.
let seed = 20261017;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000);

type Source = "open_data" | "places";
type Channel = "email_simple" | "email_diagnostic" | "voice_direct";
const SOURCES: Source[] = ["open_data", "places"];
const CHANNELS: Channel[] = ["email_simple", "email_diagnostic", "voice_direct"];

// Tasas de ejemplo por canal: [conversación, calificado | conversación, rechazo].
const RATES: Record<Channel, { conv: number; qual: number; rej: number }> = {
  voice_direct: { conv: 0.4, qual: 0.45, rej: 0.12 },
  email_diagnostic: { conv: 0.18, qual: 0.3, rej: 0.04 },
  email_simple: { conv: 0.08, qual: 0.2, rej: 0.06 },
};

const [client] = await db
  .insert(schema.client)
  .values({
    name: "Faro, proyecto de la hackathon de Dapta",
    brandName: "Faro",
    brandColor: "#CBE850",
    offer: "Diagnóstico gratuito de cómo atienden sus leads y una prueba con un agente de voz.",
    icpText: "Clínicas odontológicas y estéticas de Bogotá que abren los sábados y reciben muchas llamadas.",
    adCplCop: 10.78 * FX,
    adCplIsExternalReference: true,
  })
  .returning();

const [campaign] = await db
  .insert(schema.campaign)
  .values({
    clientId: client.id,
    name: "Clínicas Bogotá · DEMO con datos de ejemplo",
    config: { description: "DEMO", city: "Bogotá", ciiu: ["8622", "8621", "9602"], placesQueries: ["clínica odontológica en Bogotá"], filters: {}, waveSize: 90 },
    budgetCapUsd: 30,
    fxCopPerUsd: FX,
    status: "running",
    weights: { conversation: 1, qualified: 3, rejection: -1 },
    thresholds: { minMatureContactsForEvidence: 10, weakBelow: 0.8, strongFrom: 0.95, turnOffBelowPBest: 0.05, turnOffMinContacts: 15, minShareActiveArm: 0.1, maturationHours: 3 },
    startsAt: ago(300),
  })
  .returning();

await db.insert(schema.arm).values(SOURCES.flatMap((source) => CHANNELS.map((channel) => ({ campaignId: campaign.id, source, channel }))));
const [wave1] = await db.insert(schema.wave).values({ campaignId: campaign.id, n: 1, status: "sent", approvedAt: ago(250), approvedBy: "demo", humanSeconds: 540 }).returning();
await db.insert(schema.wave).values({ campaignId: campaign.id, n: 2, status: "review", reviewOpenedAt: ago(5) });

const cost = (e: Omit<typeof schema.costEvent.$inferInsert, "campaignId" | "fxCopPerUsd" | "listAmountUsd"> & { listUnitCostUsd: number; quantity: number }) => ({
  ...e,
  campaignId: campaign.id,
  fxCopPerUsd: FX,
  listAmountUsd: Math.round(e.quantity * e.listUnitCostUsd * 1e6) / 1e6,
});
const costs: (typeof schema.costEvent.$inferInsert)[] = [];

// Descubrimiento: Places cobra por request (precio de lista); datos abiertos es gratis.
costs.push(cost({ source: "places", kind: "places_request", quantity: 14, unit: "request", listUnitCostUsd: 0.035, actualAmountUsd: 0, evidence: "DEMO · Places Text Search ×14" }));
for (const source of SOURCES) {
  costs.push(cost({ source, kind: "llm_tokens", quantity: 180_000, unit: "token", listUnitCostUsd: 0.12 / 1e6, actualAmountUsd: 0.0216, evidence: `DEMO · puntuación con claude-haiku-5-5 (${source})` }));
}

// 140 leads: 50% solo datos abiertos, 30% solo Places, 20% ambas; 120 del perfil.
let assigned = 0;
const perArm = new Map<string, number>();
for (let i = 1; i <= 140; i++) {
  const r = rnd();
  const foundBy: Source[] = r < 0.5 ? ["open_data"] : r < 0.8 ? ["places"] : ["open_data", "places"];
  const inProfile = i <= 120;
  const n = String(i).padStart(3, "0");
  const [lead] = await db
    .insert(schema.lead)
    .values({
      campaignId: campaign.id,
      nit: foundBy.includes("open_data") ? `9009${n}000` : null,
      name: `Clínica Demo ${pick(["Odontológica", "Estética", "Dental", "Sonrisa"])} ${n} SAS`,
      normalizedName: `clinica demo ${n}`,
      city: "bogota",
      ciiu: pick(["8622", "8621", "9602"]),
      phoneE164: foundBy.includes("open_data") ? `+5760100${n.padStart(5, "0")}` : null,
      email: foundBy.includes("open_data") ? `demo${n}@ejemplo.invalid` : null,
      isLegalEntity: true,
      fitScore: inProfile ? 60 + Math.floor(rnd() * 40) : 20 + Math.floor(rnd() * 30),
      inProfile,
      foundBy,
      placeId: foundBy.includes("places") ? `demo-place-${n}` : null,
      assignedSource: foundBy.length === 1 ? foundBy[0] : pick(foundBy),
    })
    .returning();

  if (i === 1) {
    await db.insert(schema.fact).values([
      { leadId: lead.id, text: "Matrícula mercantil activa, renovada en 2026, actividad 8622 (práctica odontológica).", source: "RUES (datos abiertos)", license: "Datos abiertos, Confecámaras", field: "estado_matricula" },
      { leadId: lead.id, text: "Atiende de lunes a sábado según su sitio web.", source: "Sitio web corporativo (ejemplo)", url: "https://ejemplo.invalid", field: "horario" },
      { leadId: lead.id, text: "El sitio web tiene formulario de contacto pero no chat ni WhatsApp.", source: "Sitio web corporativo (ejemplo)", url: "https://ejemplo.invalid", field: "canales" },
    ]);
    await db.insert(schema.dossier).values({ leadId: lead.id, lineWho: "Clínica odontológica en Bogotá, activa desde 2019.", lineWhy: "Abre los sábados y solo recibe leads por formulario.", lineOpener: "Preguntar cuántas solicitudes les llegan fuera de horario." });
    await db.insert(schema.diagnosticToken).values({ token: DEMO_TOKEN, leadId: lead.id, expiresAt: new Date(now + 7 * 86_400_000) });
  }

  // Oleada 1: 90 leads del perfil, 15 por brazo, contactados hace ~4 h (ya maduros).
  if (!inProfile || assigned >= 90) continue;
  const source = lead.assignedSource!;
  const channel = CHANNELS.filter((c) => (perArm.get(`${source}:${c}`) ?? 0) < 15).sort((a, b) => (perArm.get(`${source}:${a}`) ?? 0) - (perArm.get(`${source}:${b}`) ?? 0))[0];
  if (!channel) continue;
  perArm.set(`${source}:${channel}`, (perArm.get(`${source}:${channel}`) ?? 0) + 1);
  assigned++;
  await db.insert(schema.armAssignment).values({ leadId: lead.id, waveId: wave1.id, source, channel, method: "random" });

  const contactedAt = ago(230 + Math.floor(rnd() * 20));
  const rate = RATES[channel];
  const placesBoost = source === "places" ? 1.15 : 1;
  const conv = rnd() < rate.conv * placesBoost;
  const qual = conv && rnd() < rate.qual;
  const rej = !conv && rnd() < rate.rej;
  const after = (min: number) => new Date(contactedAt.getTime() + min * 60_000);
  await db.insert(schema.contactAttempt).values({ leadId: lead.id, waveId: wave1.id, channel, provider: channel === "voice_direct" ? "dapta" : "brevo", status: "sent", sentAt: contactedAt, createdAt: contactedAt });
  await db.insert(schema.outcome).values({
    leadId: lead.id,
    contactedAt,
    realConversationAt: conv ? after(channel === "voice_direct" ? 2 : 90) : null,
    qualifiedAt: qual ? after(channel === "voice_direct" ? 4 : 120) : null,
    rejectionKind: rej ? (channel === "voice_direct" ? "early_hangup" : "opt_out") : null,
    rejectedAt: rej ? after(30) : null,
  });

  if (channel === "voice_direct") {
    const answered = conv || rej || rnd() < 0.2;
    const minutes = conv ? 2 + Math.floor(rnd() * 3) : 1;
    const credits = answered ? minutes * 333 : rnd() < 0.3 ? 75 : 45;
    costs.push(cost({ leadId: lead.id, source, channel, kind: answered ? "dapta_call_minutes" : "dapta_call_attempt", quantity: credits, unit: "credit", listUnitCostUsd: 0.001, actualAmountUsd: credits / 1000, evidence: `DEMO · llamada: ${credits} créditos` }));
  } else {
    costs.push(cost({ leadId: lead.id, source, channel, kind: "email_send", quantity: 1, unit: "email", listUnitCostUsd: 0.0009, actualAmountUsd: 0, evidence: "DEMO · envío Brevo" }));
  }
  const composeTokens = channel === "email_diagnostic" ? 3200 : 1900;
  costs.push(cost({ leadId: lead.id, source, channel, kind: "llm_tokens", quantity: composeTokens, unit: "token", listUnitCostUsd: 3.6 / 1e6, actualAmountUsd: (composeTokens * 3.6) / 1e6, evidence: "DEMO · redacción con claude-sonnet-5-5" }));
}
await db.insert(schema.costEvent).values(costs);

await db.insert(schema.activityEvent).values([
  { campaignId: campaign.id, kind: "done", messageKey: "activity.discoveryDone", params: { count: 140 }, createdAt: ago(290) },
  { campaignId: campaign.id, kind: "done", messageKey: "activity.waveSent", params: { n: 1, count: 90 }, createdAt: ago(240) },
  { campaignId: campaign.id, kind: "done", messageKey: "activity.callQualified", params: {}, createdAt: ago(200) },
  { campaignId: campaign.id, kind: "attention", messageKey: "activity.callNowUnknown", params: {}, createdAt: ago(60) },
  { campaignId: campaign.id, kind: "working", messageKey: "activity.composingWave", params: { n: 2 }, createdAt: ago(10) },
  { campaignId: campaign.id, kind: "attention", messageKey: "activity.waveReady", params: { n: 2 }, createdAt: ago(5) },
]);

}

// idleTimeout cierra conexiones huérfanas (p. ej. de un servidor de Next reiniciado) para no agotar el tope.
const server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 50, idleTimeout: 60_000 });
await server.start();
console.log(fresh ? "Base DEMO nueva, sembrada con datos de ejemplo." : "Base DEMO existente (usa --reset para sembrar de nuevo).");
console.log(`Base DEMO lista en postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`);
console.log(`Puente de mando: http://localhost:3000/   Diagnóstico: http://localhost:3000/d/${DEMO_TOKEN}`);

const shutdown = async () => {
  await server.stop();
  await pg.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
