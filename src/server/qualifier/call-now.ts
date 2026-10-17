// F3 "Llámenme ahora" (D29, D37, D53). Orquestación con dependencias inyectadas para testearla
// con FakeQualifier. Orden: límites → consentimiento → intento → cumplimiento → Dapta.
// Un intento nunca se reintenta sin certeza de que no salió (D30).
import { bogotaParts } from "@/lib/colombia-time";
import { isWellFormedToken } from "@/lib/token";
import { toE164 } from "@/lib/normalize";
import { checkCompliance, type BlockReason } from "@/server/lab/compliance";
import type { Qualifier } from "./qualifier";

/** Versión del texto de autorización que acepta el titular (se audita en `consent`). */
export const CONSENT_TEXT_VERSION = "v1-2026-10-17";

export const LIMITS = {
  callsPerTokenPerDay: 2,
  callsPerIpPerHour: 3,
  callsPerPhonePerDay: 2,
} as const;

export type CallNowRejection =
  | "invalid_token"
  | "expired"
  | "no_consent"
  | "invalid_phone"
  | "token_daily_limit"
  | "ip_limit"
  | "phone_limit"
  | "excluded"
  | "compliance"
  | "provider_rejected"
  | "provider_unreachable";

export type CallNowResult =
  | { ok: true; attemptId: string }
  | { ok: false; reason: CallNowRejection; complianceReasons?: BlockReason[]; attemptId?: string };

export interface DiagnosticContext {
  token: string;
  leadId: string;
  expiresAt: Date;
  callsToday: number;
  callsDay: string | null;
  lead: { isLegalEntity: boolean };
  campaign: { id: string; paused: boolean; budgetCapUsd: number };
  brand: string;
  offer: string;
  dossierSummary: string;
  language: string;
}

/** Acceso a datos que necesita el flujo. Implementación real en `call-now-store.ts`. */
export interface CallNowStore {
  getDiagnostic(token: string): Promise<DiagnosticContext | null>;
  countConsentsByIpSince(ip: string, since: Date): Promise<number>;
  countConsentsByPhoneSince(phoneE164: string, since: Date): Promise<number>;
  isExcluded(phoneE164: string): Promise<boolean>;
  lastContactAt(leadId: string): Promise<Date | null>;
  spentUsd(campaignId: string): Promise<number>;
  recordConsent(c: { leadId: string; token: string; phoneE164: string; ip: string; textVersion: string; acceptedAt: Date }): Promise<void>;
  bumpTokenCalls(token: string, day: string, callsToday: number): Promise<void>;
  createAttempt(a: { leadId: string; phoneE164: string }): Promise<string>;
  setAttempt(id: string, patch: { status: "unconfirmed" | "failed" | "blocked"; providerRef?: string | null; blockedReason?: string | null }): Promise<void>;
  logActivity(e: { campaignId: string; leadId: string; kind: "working" | "waiting" | "attention" | "done"; messageKey: string; params?: Record<string, unknown> }): Promise<void>;
}

export interface CallNowRequest {
  token: string;
  phone: string;
  consent: boolean;
  ip: string;
}

/** Costo previsto de una llamada para el tope de presupuesto: 2 min contestados (666 créditos). */
const EXPECTED_CALL_COST_USD = 0.666;

/** Inicio del día en Bogotá (00:00 −05:00) para los límites diarios. */
function bogotaDayStart(now: Date): Date {
  return new Date(`${bogotaParts(now).date}T00:00:00-05:00`);
}

export async function requestCallNow(deps: { store: CallNowStore; qualifier: Qualifier; now?: Date }, req: CallNowRequest): Promise<CallNowResult> {
  const { store, qualifier } = deps;
  const now = deps.now ?? new Date();
  if (!isWellFormedToken(req.token)) return { ok: false, reason: "invalid_token" };
  const ctx = await store.getDiagnostic(req.token);
  if (!ctx) return { ok: false, reason: "invalid_token" };
  if (ctx.expiresAt <= now) return { ok: false, reason: "expired" };
  if (!req.consent) return { ok: false, reason: "no_consent" };
  const phoneE164 = toE164(req.phone);
  if (!phoneE164) return { ok: false, reason: "invalid_phone" };

  const today = bogotaParts(now).date;
  const callsToday = ctx.callsDay === today ? ctx.callsToday : 0;
  if (callsToday >= LIMITS.callsPerTokenPerDay) return { ok: false, reason: "token_daily_limit" };
  if ((await store.countConsentsByIpSince(req.ip, new Date(now.getTime() - 3_600_000))) >= LIMITS.callsPerIpPerHour) {
    return { ok: false, reason: "ip_limit" };
  }
  if ((await store.countConsentsByPhoneSince(phoneE164, bogotaDayStart(now))) >= LIMITS.callsPerPhonePerDay) {
    return { ok: false, reason: "phone_limit" };
  }
  if (await store.isExcluded(phoneE164)) return { ok: false, reason: "excluded" };

  // Auditoría del consentimiento antes de cualquier contacto (hora, IP, texto aceptado).
  await store.recordConsent({ leadId: ctx.leadId, token: ctx.token, phoneE164, ip: req.ip, textVersion: CONSENT_TEXT_VERSION, acceptedAt: now });
  await store.bumpTokenCalls(ctx.token, today, callsToday + 1);
  const attemptId = await store.createAttempt({ leadId: ctx.leadId, phoneE164 });

  const compliance = checkCompliance({
    now,
    channel: "voice",
    lead: { isLegalEntity: ctx.lead.isLegalEntity, phoneE164, email: null },
    lastContactAt: await store.lastContactAt(ctx.leadId),
    excluded: false, // ya verificado arriba para este número
    budget: { spentUsd: await store.spentUsd(ctx.campaign.id), capUsd: ctx.campaign.budgetCapUsd, nextCostUsd: EXPECTED_CALL_COST_USD },
    campaignPaused: ctx.campaign.paused,
    armActive: true,
    requestedByHolder: { consentAt: now },
  });
  if (!compliance.allowed) {
    await store.setAttempt(attemptId, { status: "blocked", blockedReason: compliance.reasons.join(",") });
    await store.logActivity({ campaignId: ctx.campaign.id, leadId: ctx.leadId, kind: "attention", messageKey: "activity.callNowBlocked", params: { reasons: compliance.reasons.join(", ") } });
    return { ok: false, reason: "compliance", complianceReasons: compliance.reasons, attemptId };
  }

  try {
    const res = await qualifier.callNow({
      attemptId,
      phoneE164,
      vars: { faro_attempt_id: attemptId, brand: ctx.brand, offer: ctx.offer, dossier_summary: ctx.dossierSummary, opening_check: "requested", language: ctx.language },
    });
    if (!res.accepted) {
      // Rechazo explícito del proveedor: la llamada no salió.
      await store.setAttempt(attemptId, { status: "failed" });
      await store.logActivity({ campaignId: ctx.campaign.id, leadId: ctx.leadId, kind: "attention", messageKey: "activity.callNowRejected" });
      return { ok: false, reason: "provider_rejected", attemptId };
    }
    // Aceptada por el flow: queda sin confirmar hasta que llegue el webhook de la llamada.
    await store.setAttempt(attemptId, { status: "unconfirmed" });
    await store.logActivity({ campaignId: ctx.campaign.id, leadId: ctx.leadId, kind: "waiting", messageKey: "activity.waitingDapta" });
    return { ok: true, attemptId };
  } catch {
    // Timeout o red: no sabemos si salió. Sin confirmar y pide atención; nunca se reintenta solo.
    await store.setAttempt(attemptId, { status: "unconfirmed" });
    await store.logActivity({ campaignId: ctx.campaign.id, leadId: ctx.leadId, kind: "attention", messageKey: "activity.callNowUnknown" });
    return { ok: false, reason: "provider_unreachable", attemptId };
  }
}
