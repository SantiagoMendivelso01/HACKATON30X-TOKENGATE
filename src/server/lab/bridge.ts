// Datos del puente de mando: lee una campaña (o la más reciente) y calcula métricas, Thompson, frase y siguiente paso.
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CostEntry } from "@/server/costs/ledger";
import { ALL_ARMS, armId, campaignConfigSchema, channelKind, DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, thresholdsSchema, weightsSchema, type ArmKey } from "./config";
import { computeMetrics, matureEvidence, type CampaignMetrics, type CostView, type LeadOutcomeRow } from "./metrics";
import { templateRecommendation, type Recommendation } from "./recommendation";
import { hashSeed, seededRng } from "./stats";
import { nextWavePlan, type ThompsonResult } from "./thompson";

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
  nextAction: NextAction;
  progress: CampaignProgress;
}

export type StepKey = "leads" | "wave" | "review" | "send" | "results" | "decide";
export const STEPS: StepKey[] = ["leads", "wave", "review", "send", "results", "decide"];

export interface CampaignProgress {
  current: StepKey;
  /** Cuándo maduran los primeros resultados (contacto + maduración), si ya hubo contactos. */
  firstMatureAt: Date | null;
}

/** En qué fase va la campaña, para el indicador de progreso del puente de mando. */
export function campaignProgress(input: {
  found: number;
  waves: { n: number; status: string }[];
  contactedAt: Date[];
  matureContacts: number;
  maturationHours: number;
}): CampaignProgress {
  const first = input.contactedAt.length ? new Date(Math.min(...input.contactedAt.map((d) => d.getTime()))) : null;
  const firstMatureAt = first ? new Date(first.getTime() + input.maturationHours * 3_600_000) : null;
  const has = (...st: string[]) => input.waves.some((w) => st.includes(w.status));
  let current: StepKey;
  if (input.found === 0) current = "leads";
  else if (input.matureContacts > 0) current = "decide";
  else if (input.contactedAt.length > 0) current = "results";
  else if (has("approved", "sending")) current = "send";
  else if (has("review")) current = "review";
  else current = "wave";
  return { current, firstMatureAt };
}

/** El paso que sigue en el embudo de la campaña, para la tarjeta "Acción pendiente". */
export type NextAction =
  | { kind: "reviewWave"; n: number }
  | { kind: "composingWave"; n: number }
  | { kind: "buildWave"; n: number; available: number; waveSize: number }
  | { kind: "findLeads" }
  | { kind: "none" };

export function decideNextAction(input: {
  waves: { n: number; status: string }[];
  inProfileUnassigned: number;
  inProfileTotal: number;
  waveSize: number;
}): NextAction {
  const review = input.waves.find((w) => w.status === "review");
  if (review) return { kind: "reviewWave", n: review.n };
  const composing = input.waves.find((w) => w.status === "draft" || w.status === "composing");
  if (composing) return { kind: "composingWave", n: composing.n };
  if (input.inProfileTotal === 0) return { kind: "findLeads" };
  if (input.inProfileUnassigned > 0) {
    const n = Math.max(0, ...input.waves.map((w) => w.n)) + 1;
    return { kind: "buildWave", n, available: input.inProfileUnassigned, waveSize: input.waveSize };
  }
  return { kind: "none" };
}

export async function listCampaigns() {
  return db().select({ id: schema.campaign.id, name: schema.campaign.name }).from(schema.campaign).orderBy(desc(schema.campaign.createdAt));
}

export async function loadBridge(campaignId?: string, view: CostView = "variable", now = new Date()): Promise<BridgeData | null> {
  const d = db();
  const [campaign] = campaignId
    ? await d.select().from(schema.campaign).where(eq(schema.campaign.id, campaignId)).limit(1)
    : await d.select().from(schema.campaign).orderBy(desc(schema.campaign.createdAt)).limit(1);
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
  const ts = nextWavePlan(evidence, weights, thresholds, seededRng(seed));
  const recommendation = templateRecommendation(metrics, ts, campaign.fxCopPerUsd);

  const activity = await d
    .select()
    .from(schema.activityEvent)
    .where(eq(schema.activityEvent.campaignId, campaign.id))
    .orderBy(desc(schema.activityEvent.createdAt))
    .limit(30);

  const waves = await d.select({ n: schema.wave.n, status: schema.wave.status }).from(schema.wave).where(eq(schema.wave.campaignId, campaign.id));
  const waveSize = campaignConfigSchema.safeParse(campaign.config).data?.waveSize ?? 90;
  const nextAction = decideNextAction({
    waves,
    inProfileTotal: rows.filter((r) => r.inProfile).length,
    inProfileUnassigned: rows.filter((r) => r.inProfile && !r.arm).length,
    waveSize,
  });

  const progress = campaignProgress({
    found: rows.length,
    waves,
    contactedAt: rows.map((r) => r.contactedAt).filter((d): d is Date => Boolean(d)),
    matureContacts: ts.matureContactsTotal,
    maturationHours: thresholds.maturationHours,
  });

  return {
    progress,
    campaign: { id: campaign.id, name: campaign.name, paused: campaign.paused, fxCopPerUsd: campaign.fxCopPerUsd },
    metrics,
    thompson: ts,
    recommendation,
    activity,
    nextAction,
  };
}
