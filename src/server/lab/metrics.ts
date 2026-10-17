// Métricas del puente de mando (ADR-002). Funciones puras sobre resultados y asientos.
import type { CostEntry } from "@/server/costs/ledger";
import { ALL_ARMS, armId, channelKind, SOURCES, type ArmKey, type Source } from "./config";
import { wilson } from "./stats";
import type { ArmEvidence } from "./thompson";

export type CostView = "variable" | "total";

export interface LeadOutcomeRow {
  leadId: string;
  foundBy: Source[];
  inProfile: boolean;
  arm: ArmKey | null;
  contactedAt: Date | null;
  realConversationAt: Date | null;
  qualifiedAt: Date | null;
  rejectedAt: Date | null;
}

export interface FixedCost {
  amountUsd: number;
  /** A qué canales se imputa (D15): exclusivo de voz, exclusivo de email o compartido. */
  scope: "voice" | "email" | "shared";
}

export interface Ratio {
  value: number | null; // null = sin denominador
  numeratorUsd: number;
  denominator: number;
}

export interface ArmMetrics {
  arm: ArmKey;
  id: string;
  contacted: number;
  conversations: number;
  qualified: number;
  rejections: number;
  costUsd: number;
  costPerConversation: Ratio;
  cpql: Ratio;
  costPerNonRejected: Ratio;
  qualifiedRate: { p: number; low: number; high: number };
  rejectionRate: { p: number; low: number; high: number };
}

export interface SourceMetrics {
  source: Source;
  inProfile: number;
  exclusive: number;
  costUsd: number;
  cplGross: Ratio;
  cplIncremental: Ratio;
}

export interface CampaignMetrics {
  view: CostView;
  arms: ArmMetrics[];
  sources: SourceMetrics[];
  totals: { found: number; inProfile: number; contacted: number; conversations: number; qualified: number; rejections: number; costUsd: number };
}

const ratio = (numeratorUsd: number, denominator: number): Ratio => ({
  value: denominator > 0 ? numeratorUsd / denominator : null,
  numeratorUsd,
  denominator,
});

const isSourceCost = (e: CostEntry) => e.source != null && e.channel == null && !e.isFixed;
const armOfEntry = (e: CostEntry) => (e.source && e.channel ? armId({ source: e.source, channel: e.channel }) : null);

/** Reparte los fijos entre brazos en proporción a sus contactos, según el alcance. */
export function prorateFixed(fixed: FixedCost[], contactsByArm: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(ALL_ARMS.map((a) => [armId(a), 0]));
  for (const f of fixed) {
    const inScope = ALL_ARMS.filter((a) => f.scope === "shared" || channelKind(a.channel) === f.scope);
    const total = inScope.reduce((s, a) => s + (contactsByArm[armId(a)] ?? 0), 0);
    for (const a of inScope) {
      const share = total > 0 ? (contactsByArm[armId(a)] ?? 0) / total : 1 / inScope.length;
      out[armId(a)] += f.amountUsd * share;
    }
  }
  return out;
}

export function computeMetrics(rows: LeadOutcomeRow[], costs: CostEntry[], opts: { view: CostView; fixed?: FixedCost[] }): CampaignMetrics {
  const contactsByArm: Record<string, number> = {};
  for (const r of rows) if (r.arm && r.contactedAt) contactsByArm[armId(r.arm)] = (contactsByArm[armId(r.arm)] ?? 0) + 1;
  const fixedByArm = opts.view === "total" ? prorateFixed(opts.fixed ?? [], contactsByArm) : {};

  const arms = ALL_ARMS.map((arm): ArmMetrics => {
    const id = armId(arm);
    const mine = rows.filter((r) => r.arm && armId(r.arm) === id && r.contactedAt);
    const contacted = mine.length;
    const conversations = mine.filter((r) => r.realConversationAt).length;
    const qualified = mine.filter((r) => r.qualifiedAt).length;
    const rejections = mine.filter((r) => r.rejectedAt).length;
    const variable = costs.filter((e) => !e.isFixed && armOfEntry(e) === id).reduce((s, e) => s + e.listAmountUsd, 0);
    const costUsd = variable + (fixedByArm[id] ?? 0);
    return {
      arm,
      id,
      contacted,
      conversations,
      qualified,
      rejections,
      costUsd,
      costPerConversation: ratio(costUsd, conversations),
      cpql: ratio(costUsd, qualified),
      costPerNonRejected: ratio(costUsd, contacted - rejections),
      qualifiedRate: wilson(qualified, contacted),
      rejectionRate: wilson(rejections, contacted),
    };
  });

  const profile = rows.filter((r) => r.inProfile);
  const sources = SOURCES.map((source): SourceMetrics => {
    const inProfile = profile.filter((r) => r.foundBy.includes(source)).length;
    const exclusive = profile.filter((r) => r.foundBy.length === 1 && r.foundBy[0] === source).length;
    const costUsd = costs.filter((e) => isSourceCost(e) && e.source === source).reduce((s, e) => s + e.listAmountUsd, 0);
    return { source, inProfile, exclusive, costUsd, cplGross: ratio(costUsd, inProfile), cplIncremental: ratio(costUsd, exclusive) };
  });

  const sum = (k: "contacted" | "conversations" | "qualified" | "rejections") => arms.reduce((s, a) => s + a[k], 0);
  return {
    view: opts.view,
    arms,
    sources,
    totals: {
      found: rows.length,
      inProfile: profile.length,
      contacted: sum("contacted"),
      conversations: sum("conversations"),
      qualified: sum("qualified"),
      rejections: sum("rejections"),
      costUsd: costs.filter((e) => opts.view === "total" || !e.isFixed).reduce((s, e) => s + e.listAmountUsd, 0),
    },
  };
}

/** Evidencia madura por brazo para Thompson: solo contactos con ≥ maturationHours. */
export function matureEvidence(
  rows: LeadOutcomeRow[],
  costs: CostEntry[],
  now: Date,
  maturationHours: number,
  activeArms: Set<string>,
  priorCostPerContactUsd: (arm: ArmKey) => number,
): ArmEvidence[] {
  const cutoff = now.getTime() - maturationHours * 3_600_000;
  return ALL_ARMS.map((arm) => {
    const id = armId(arm);
    const mature = rows.filter((r) => r.arm && armId(r.arm) === id && r.contactedAt && r.contactedAt.getTime() <= cutoff);
    const ids = new Set(mature.map((r) => r.leadId));
    // Un resultado cuenta solo si llegó dentro de la ventana de madurez: igual para todos los brazos.
    const within = (d: Date | null, r: LeadOutcomeRow) =>
      d != null && d.getTime() - r.contactedAt!.getTime() <= maturationHours * 3_600_000;
    return {
      arm,
      active: activeArms.has(id),
      matureContacts: mature.length,
      conversations: mature.filter((r) => within(r.realConversationAt, r)).length,
      qualified: mature.filter((r) => within(r.qualifiedAt, r)).length,
      rejections: mature.filter((r) => within(r.rejectedAt, r)).length,
      costUsd: costs.filter((e) => !e.isFixed && armOfEntry(e) === id && e.leadId && ids.has(e.leadId)).reduce((s, e) => s + e.listAmountUsd, 0),
      priorCostPerContactUsd: priorCostPerContactUsd(arm),
    };
  });
}
