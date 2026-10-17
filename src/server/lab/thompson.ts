// Reasignación por muestreo de Thompson sobre valor ponderado ÷ costo (D11, D12, D42).
import { armId, type ArmKey, type Thresholds, type Weights } from "./config";
import { sampleBeta, type Rng } from "./stats";

export interface ArmEvidence {
  arm: ArmKey;
  active: boolean;
  /** Contactos con resultado maduro (≥ maturationHours desde el contacto). */
  matureContacts: number;
  conversations: number;
  qualified: number;
  rejections: number;
  /** Costo variable de esos contactos maduros, USD. */
  costUsd: number;
  /** Costo esperado por contacto si aún no hay datos (de las tarifas de lista). */
  priorCostPerContactUsd: number;
}

export type EvidenceLevel = "insufficient" | "weak" | "moderate" | "strong";

export interface ThompsonResult {
  pBest: Record<string, number>;
  /** Mezcla de la próxima oleada por brazo (suma 1 sobre los activos). */
  mix: Record<string, number>;
  turnedOff: string[];
  leader: string | null;
  evidence: EvidenceLevel;
  matureContactsTotal: number;
}

export function costPerContact(a: ArmEvidence): number {
  const c = a.matureContacts > 0 ? a.costUsd / a.matureContacts : a.priorCostPerContactUsd;
  return Math.max(c, 1e-6);
}

export function thompson(arms: ArmEvidence[], weights: Weights, thresholds: Thresholds, rng: Rng, draws = 4000): ThompsonResult {
  const active = arms.filter((a) => a.active);
  const ids = active.map((a) => armId(a.arm));
  const wins = new Map(ids.map((id) => [id, 0]));

  for (let d = 0; d < draws && active.length; d++) {
    let best = -Infinity;
    let bestId = ids[0];
    for (const a of active) {
      const n = a.matureContacts;
      const pc = sampleBeta(1 + a.conversations, 1 + n - a.conversations, rng);
      const pq = sampleBeta(1 + a.qualified, 1 + n - a.qualified, rng);
      const pr = sampleBeta(1 + a.rejections, 1 + n - a.rejections, rng);
      const value = (weights.conversation * pc + weights.qualified * pq + weights.rejection * pr) / costPerContact(a);
      if (value > best) {
        best = value;
        bestId = armId(a.arm);
      }
    }
    wins.set(bestId, (wins.get(bestId) ?? 0) + 1);
  }

  const pBest: Record<string, number> = {};
  for (const a of arms) pBest[armId(a.arm)] = a.active && active.length ? (wins.get(armId(a.arm)) ?? 0) / draws : 0;

  const turnedOff = active
    .filter((a) => pBest[armId(a.arm)] < thresholds.turnOffBelowPBest && a.matureContacts >= thresholds.turnOffMinContacts)
    .map((a) => armId(a.arm));
  const stillActive = ids.filter((id) => !turnedOff.includes(id));

  const mix = applyFloor(
    Object.fromEntries(stillActive.map((id) => [id, pBest[id]])),
    thresholds.minShareActiveArm,
  );
  for (const a of arms) mix[armId(a.arm)] ??= 0;

  const leader = stillActive.length ? stillActive.reduce((x, y) => (pBest[y] > pBest[x] ? y : x)) : null;
  const matureContactsTotal = arms.reduce((s, a) => s + a.matureContacts, 0);
  const insufficient = active.some((a) => a.matureContacts < thresholds.minMatureContactsForEvidence);
  const lp = leader ? pBest[leader] : 0;
  const evidence: EvidenceLevel = insufficient
    ? "insufficient"
    : lp >= thresholds.strongFrom
      ? "strong"
      : lp >= thresholds.weakBelow
        ? "moderate"
        : "weak";

  return { pBest, mix, turnedOff, leader, evidence, matureContactsTotal };
}

/** Normaliza y garantiza un mínimo por brazo activo; el resto se reparte en proporción. */
export function applyFloor(shares: Record<string, number>, floor: number): Record<string, number> {
  const ids = Object.keys(shares);
  if (!ids.length) return {};
  if (floor * ids.length >= 1) return Object.fromEntries(ids.map((id) => [id, 1 / ids.length]));
  const result: Record<string, number> = {};
  let free = ids;
  let budget = 1;
  for (;;) {
    const total = free.reduce((s, id) => s + shares[id], 0);
    const prop = (id: string) => (total > 0 ? (shares[id] / total) * budget : budget / free.length);
    const below = free.filter((id) => prop(id) < floor);
    if (!below.length) {
      for (const id of free) result[id] = prop(id);
      return result;
    }
    for (const id of below) result[id] = floor;
    budget -= floor * below.length;
    free = free.filter((id) => !below.includes(id));
  }
}

/** Mezcla uniforme de la oleada 1. */
export function uniformMix(arms: ArmKey[]): Record<string, number> {
  return Object.fromEntries(arms.map((a) => [armId(a), 1 / arms.length]));
}

/**
 * Plan de la próxima oleada (D46): sin resultados maduros no hay nada que aprender, así que el
 * reparto es uniforme entre los brazos activos (oleada 1). Con resultados maduros, Thompson.
 */
export function nextWavePlan(arms: ArmEvidence[], weights: Weights, thresholds: Thresholds, rng: Rng): ThompsonResult {
  const total = arms.reduce((s, a) => s + a.matureContacts, 0);
  if (total > 0) return thompson(arms, weights, thresholds, rng);
  const active = arms.filter((a) => a.active).map((a) => a.arm);
  const mix = uniformMix(active);
  const pBest = Object.fromEntries(arms.map((a) => [armId(a.arm), a.active && active.length ? 1 / active.length : 0]));
  for (const a of arms) mix[armId(a.arm)] ??= 0;
  return { pBest, mix, turnedOff: [], leader: null, evidence: "insufficient", matureContactsTotal: 0 };
}
