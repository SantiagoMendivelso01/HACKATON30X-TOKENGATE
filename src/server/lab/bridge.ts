// Datos del puente de mando: lee la campaña más reciente y calcula métricas, Thompson y frase.
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CostEntry } from "@/server/costs/ledger";
import { ALL_ARMS, armId, channelKind, DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, thresholdsSchema, weightsSchema, type ArmKey } from "./config";
import { computeMetrics, matureEvidence, type CampaignMetrics, type CostView, type LeadOutcomeRow } from "./metrics";
import { templateRecommendation, type Recommendation } from "./recommendation";
import { hashSeed, seededRng } from "./stats";
import { thompson, type ThompsonResult } from "./thompson";

/** Costo esperado por contacto antes de tener datos (tarifas de lista, supuestos [H]). */
export function priorCostPerContactUsd(arm: ArmKey): number {
  // Voz: 25% contesta ~2 min (666 créditos), el resto sin respuesta (45). Email: envío + redacción.
  return channelKind(arm.channel) === "voice" ? 0.25 * 0.666 + 0.75 * 0.045 : 0.003;
}

export interface BridgeData {
  campaign: { id: string; name: string; paused: boolean; fxCopPerUsd: number };
  metrics: CampaignMetrics;
  thompson: ThompsonResult;
  recommendation: Recommendation;
  activity: { id: string; kind: "working" | "waiting" | "attention" | "done"; messageKey: string; params: unknown; createdAt: Date }[];
  pendingWave: { id: string; n: number } | null;
}

export async function loadBridge(view: CostView = "variable", now = new Date()): Promise<BridgeData | null> {
  const d = db();
  const [campaign] = await d.select().from(schema.campaign).orderBy(desc(schema.campaign.createdAt)).limit(1);
  if (!campaign) return null;

  const leads = await d
    .select({ lead: schema.lead, outcome: schema.outcome })
    .from(schema.lead)
    .leftJoin(schema.outcome, eq(schema.outcome.leadId, schema.lead.id))
    .where(eq(schema.lead.campaignId, campaign.id));

  const leadIds = leads.map((l) => l.lead.id);
  const assignments = leadIds.length
    ? await d.select().from(schema.armAssignment).where(inArray(schema.armAssignment.leadId, leadIds))
    : [];
  const armByLead = new Map<string, ArmKey>();
  for (const a of assignments.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
    armByLead.set(a.leadId, { source: a.source, channel: a.channel });
  }

  const rows: LeadOutcomeRow[] = leads.map(({ lead, outcome }) => ({
    leadId: lead.id,
    foundBy: lead.foundBy,
    inProfile: lead.inProfile,
    arm: armByLead.get(lead.id) ?? null,
    contactedAt: outcome?.contactedAt ?? null,
    realConversationAt: outcome?.realConversationAt ?? null,
    qualifiedAt: outcome?.qualifiedAt ?? null,
    rejectedAt: outcome?.rejectedAt ?? null,
  }));

  const costs: CostEntry[] = (await d.select().from(schema.costEvent).where(eq(schema.costEvent.campaignId, campaign.id))).map((c) => ({
    ...c,
    evidence: c.evidence,
  }));

  const armRows = await d.select().from(schema.arm).where(eq(schema.arm.campaignId, campaign.id));
  const inactive = new Set(armRows.filter((a) => !a.active).map((a) => armId(a)));
  const active = new Set(ALL_ARMS.map(armId).filter((id) => !inactive.has(id)));

  const weights = weightsSchema.safeParse(campaign.weights).data ?? DEFAULT_WEIGHTS;
  const thresholds = thresholdsSchema.safeParse(campaign.thresholds).data ?? DEFAULT_THRESHOLDS;
  const metrics = computeMetrics(rows, costs, { view });
  const evidence = matureEvidence(rows, costs, now, thresholds.maturationHours, active, priorCostPerContactUsd);
  // Semilla estable por campaña y hora: la frase no cambia en cada consulta de 3 s.
  const seed = hashSeed(`${campaign.id}:${now.toISOString().slice(0, 13)}`);
  const ts = thompson(evidence, weights, thresholds, seededRng(seed));
  const recommendation = templateRecommendation(metrics, ts, campaign.fxCopPerUsd);

  const activity = await d
    .select()
    .from(schema.activityEvent)
    .where(eq(schema.activityEvent.campaignId, campaign.id))
    .orderBy(desc(schema.activityEvent.createdAt))
    .limit(30);

  const [pendingWave] = await d
    .select({ id: schema.wave.id, n: schema.wave.n })
    .from(schema.wave)
    .where(and(eq(schema.wave.campaignId, campaign.id), eq(schema.wave.status, "review")))
    .limit(1);

  return {
    campaign: { id: campaign.id, name: campaign.name, paused: campaign.paused, fxCopPerUsd: campaign.fxCopPerUsd },
    metrics,
    thompson: ts,
    recommendation,
    activity,
    pendingWave: pendingWave ?? null,
  };
}
