// Adaptador Dapta (ADR-006). El esquema del webhook es PROVISIONAL: lo fija la prueba técnica
// (payload real en fixtures/dapta/). Se toleran las dos formas documentadas: `call_analysis`
// dentro de `call` (estilo Retell) o al nivel raíz.
import { z } from "zod";
import type { CallRequest, ParseOutcome, Qualifier } from "./qualifier";

const analysisSchema = z
  .object({
    call_summary: z.string().nullish(),
    user_sentiment: z.string().nullish(),
    in_voicemail: z.boolean().nullish(),
    custom_analysis_data: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const callSchema = z
  .object({
    call_id: z.string(),
    to_number: z.string().nullish(),
    call_status: z.string().nullish(),
    disconnection_reason: z.string().nullish(),
    start_timestamp: z.number().nullish(),
    end_timestamp: z.number().nullish(),
    duration_ms: z.number().nullish(),
    recording_url: z.string().nullish(),
    transcript_object: z.array(z.object({ role: z.string(), content: z.string() }).passthrough()).nullish(),
    retell_llm_dynamic_variables: z.record(z.string(), z.unknown()).nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
    call_analysis: analysisSchema.nullish(),
  })
  .passthrough();

const webhookSchema = z
  .object({
    event: z.string().nullish(),
    call: callSchema,
    call_analysis: analysisSchema.nullish(),
    recording_url: z.string().nullish(),
  })
  .passthrough();

/** Nombre de la variable de calificación en el análisis post-llamada del agente. */
export const QUALIFIED_VARIABLE = "lead_calificado";
export const NOT_REQUESTED_VARIABLE = "no_solicito_llamada";

const truthy = (v: unknown) => v === true || (typeof v === "string" && /^(true|s[ií]|yes)$/i.test(v.trim()));

export function parseDaptaWebhook(raw: unknown): ParseOutcome {
  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) return { ambiguous: true, reason: `payload no reconocido: ${parsed.error.issues[0]?.message}`, raw };
  const { call } = parsed.data;
  const analysis = call.call_analysis ?? parsed.data.call_analysis ?? {};
  const vars = { ...(call.metadata ?? {}), ...(call.retell_llm_dynamic_variables ?? {}) };
  const custom = analysis.custom_analysis_data ?? {};
  const attemptId = typeof vars.faro_attempt_id === "string" ? vars.faro_attempt_id : null;
  const durationSec =
    call.duration_ms != null
      ? Math.round(call.duration_ms / 1000)
      : call.start_timestamp != null && call.end_timestamp != null
        ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : null;
  const voicemail = analysis.in_voicemail === true || /voicemail/i.test(call.disconnection_reason ?? "");
  const answered = !/no_answer|busy|failed|not_connected|dial_/i.test(`${call.call_status ?? ""} ${call.disconnection_reason ?? ""}`) && (durationSec ?? 0) > 0;
  const leadResponded = (call.transcript_object ?? []).some((t) => t.role === "user" && t.content.trim().length > 0);
  const qualifiedRaw = custom[QUALIFIED_VARIABLE];

  return {
    callId: call.call_id,
    attemptId,
    toNumber: call.to_number ?? null,
    answered,
    voicemail,
    durationSec,
    qualified: qualifiedRaw === undefined ? null : truthy(qualifiedRaw),
    leadResponded,
    notRequested: truthy(custom[NOT_REQUESTED_VARIABLE]),
    variables: custom,
    summary: analysis.call_summary ?? null,
    sentiment: analysis.user_sentiment ?? null,
    recordingUrl: call.recording_url ?? parsed.data.recording_url ?? null,
    startedAt: call.start_timestamp != null ? new Date(call.start_timestamp) : null,
    raw,
  };
}

/** Validación del webhook: cabecera secreta + allowlist de IPs (ADR-006, S-O). */
export function authorizeDaptaWebhook(headers: Headers, opts: { secret: string; allowedIps: string[] }): boolean {
  if (!opts.secret || headers.get("x-faro-secret") !== opts.secret) return false;
  if (!opts.allowedIps.length) return true;
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? "";
  return opts.allowedIps.includes(ip);
}

export class DaptaQualifier implements Qualifier {
  constructor(private urls: { callNow: string; enqueue: string }) {}

  private async post(url: string, input: CallRequest) {
    if (!url) throw new Error("URL de Public Route de Dapta sin configurar");
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: input.phoneE164, external_id: input.attemptId, ...input.vars }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = JSON.parse(text);
    } catch {}
    return { accepted: res.ok, raw };
  }

  callNow(input: CallRequest) {
    return this.post(this.urls.callNow, input);
  }

  enqueue(input: CallRequest) {
    return this.post(this.urls.enqueue, input);
  }

  parseResult(raw: unknown) {
    return parseDaptaWebhook(raw);
  }
}
