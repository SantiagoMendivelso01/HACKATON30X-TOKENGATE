// Constructores puros de asientos del libro de costos (ADR-002). Quien persiste es el llamador.
import type { Channel, Source } from "@/server/lab/config";
import { DAPTA_CREDITS, LLM_PRICES, RATES } from "./rates";

export type CostKind =
  | "places_request"
  | "llm_tokens"
  | "email_send"
  | "dapta_call_minutes"
  | "dapta_call_attempt"
  | "fixed_prorated"
  | "human_minutes";

export interface CostEntry {
  campaignId: string;
  leadId?: string | null;
  source?: Source | null;
  channel?: Channel | null;
  kind: CostKind;
  quantity: number;
  unit: string;
  listUnitCostUsd: number;
  listAmountUsd: number;
  actualAmountUsd: number;
  fxCopPerUsd: number;
  isFixed: boolean;
  estimated: boolean;
  evidence: string;
}

interface Ctx {
  campaignId: string;
  fxCopPerUsd: number;
  leadId?: string | null;
  source?: Source | null;
  channel?: Channel | null;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function entry(ctx: Ctx, e: Omit<CostEntry, "campaignId" | "fxCopPerUsd" | "listAmountUsd" | "leadId" | "source" | "channel">): CostEntry {
  return {
    campaignId: ctx.campaignId,
    fxCopPerUsd: ctx.fxCopPerUsd,
    leadId: ctx.leadId ?? null,
    source: ctx.source ?? null,
    channel: ctx.channel ?? null,
    ...e,
    listAmountUsd: round6(e.quantity * e.listUnitCostUsd),
  };
}

export function placesRequestCost(ctx: Ctx, requests: number, withinFreeTier: boolean): CostEntry {
  const r = RATES.places_request;
  return entry(ctx, {
    kind: "places_request",
    quantity: requests,
    unit: r.unit,
    listUnitCostUsd: r.listUnitCostUsd,
    actualAmountUsd: withinFreeTier ? 0 : round6(requests * r.listUnitCostUsd),
    isFixed: false,
    estimated: false,
    evidence: `Places Text Search ×${requests} · ${r.url} (${r.checkedAt})`,
  });
}

export function llmCost(ctx: Ctx, model: string, inputTokens: number, outputTokens: number, task: string): CostEntry {
  const p = LLM_PRICES[model];
  if (!p) throw new Error(`Sin tarifa para el modelo ${model}`);
  const amount = (inputTokens * p.inputPerMTok + outputTokens * p.outputPerMTok) / 1e6;
  const tokens = inputTokens + outputTokens;
  return entry(ctx, {
    kind: "llm_tokens",
    quantity: tokens,
    unit: "token",
    listUnitCostUsd: tokens ? amount / tokens : 0,
    actualAmountUsd: round6(amount),
    isFixed: false,
    estimated: false,
    evidence: `${task} · ${model} · ${inputTokens} in / ${outputTokens} out · ${p.url}`,
  });
}

export function emailSendCost(ctx: Ctx, withinFreeTier: boolean): CostEntry {
  const r = RATES.email_send;
  return entry(ctx, {
    kind: "email_send",
    quantity: 1,
    unit: r.unit,
    listUnitCostUsd: r.listUnitCostUsd,
    actualAmountUsd: withinFreeTier ? 0 : r.listUnitCostUsd,
    isFixed: false,
    estimated: false,
    evidence: `Envío Brevo · ${r.url} (${r.checkedAt})`,
  });
}

export interface CallCostInput {
  answered: boolean;
  voicemail: boolean;
  durationSec: number | null;
  failed?: boolean;
}

/** Créditos de una llamada: 333/min contestado (redondeo al minuto), 75 buzón, 45 sin respuesta. */
export function daptaCallCredits(c: CallCostInput): { credits: number; minutes: number; estimated: boolean } {
  if (c.failed) return { credits: DAPTA_CREDITS.failed, minutes: 0, estimated: false };
  if (c.voicemail) return { credits: DAPTA_CREDITS.voicemail, minutes: 0, estimated: false };
  if (!c.answered) return { credits: DAPTA_CREDITS.noAnswer, minutes: 0, estimated: false };
  if (c.durationSec == null) return { credits: DAPTA_CREDITS.answeredPerMinute, minutes: 1, estimated: true };
  const minutes = Math.max(1, Math.ceil(c.durationSec / 60));
  return { credits: minutes * DAPTA_CREDITS.answeredPerMinute, minutes, estimated: false };
}

export function daptaCallCost(ctx: Ctx, c: CallCostInput, callId: string): CostEntry {
  const r = RATES.dapta_credit;
  const { credits, minutes, estimated } = daptaCallCredits(c);
  const answered = c.answered && !c.voicemail && !c.failed;
  return entry(ctx, {
    kind: answered ? "dapta_call_minutes" : "dapta_call_attempt",
    quantity: credits,
    unit: r.unit,
    listUnitCostUsd: r.listUnitCostUsd,
    actualAmountUsd: round6(credits * r.listUnitCostUsd),
    isFixed: false,
    estimated,
    evidence: answered
      ? `Llamada ${callId}: ${minutes} min × ${DAPTA_CREDITS.answeredPerMinute} créditos${estimated ? " (duración estimada)" : ""}`
      : `Llamada ${callId}: ${c.voicemail ? "buzón" : c.failed ? "fallida" : "sin respuesta"} · ${credits} créditos`,
  });
}

export function humanMinutesCost(ctx: Ctx, minutes: number, hourlyRateUsd: number | null): CostEntry {
  return entry(ctx, {
    kind: "human_minutes",
    quantity: minutes,
    unit: "minute",
    listUnitCostUsd: hourlyRateUsd ? hourlyRateUsd / 60 : 0,
    actualAmountUsd: 0,
    isFixed: false,
    estimated: false,
    evidence: `Tiempo humano de revisión: ${minutes.toFixed(1)} min${hourlyRateUsd ? ` a US$${hourlyRateUsd}/h` : " (tarifa apagada)"}`,
  });
}

export function fixedProratedCost(ctx: Ctx, key: string, monthlyUsd: number, campaignDays: number, url: string): CostEntry {
  const amount = (monthlyUsd / 30) * campaignDays;
  return entry(ctx, {
    kind: "fixed_prorated",
    quantity: campaignDays,
    unit: "day",
    listUnitCostUsd: monthlyUsd / 30,
    actualAmountUsd: round6(amount),
    isFixed: true,
    estimated: false,
    evidence: `${key}: US$${monthlyUsd}/mes × ${campaignDays} días / 30 · ${url}`,
  });
}
