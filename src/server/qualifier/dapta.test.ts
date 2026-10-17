import { describe, expect, it } from "vitest";
import { authorizeDaptaWebhook, parseDaptaWebhook } from "./dapta";
import { FakeQualifier } from "./fake";

// Payload ilustrativo con la forma documentada. Reemplazar por fixtures/dapta/*.json tras la prueba técnica.
const sample = {
  event: "call_analyzed",
  call: {
    call_id: "call_123",
    to_number: "+573001112233",
    call_status: "ended",
    disconnection_reason: "user_hangup",
    start_timestamp: 1_760_706_000_000,
    end_timestamp: 1_760_706_095_000,
    recording_url: "https://example.com/rec.wav",
    transcript_object: [
      { role: "agent", content: "Hola, ¿usted solicitó esta llamada?" },
      { role: "user", content: "Sí, claro." },
    ],
    retell_llm_dynamic_variables: { faro_attempt_id: "att_1" },
    call_analysis: {
      call_summary: "Clínica con 40 leads al mes, interesada.",
      user_sentiment: "Positive",
      in_voicemail: false,
      custom_analysis_data: { lead_calificado: "true", volumen_leads: 40 },
    },
  },
};

describe("parseDaptaWebhook", () => {
  it("extrae la correlación, la duración y la calificación", () => {
    const r = parseDaptaWebhook(sample);
    expect(r).toMatchObject({
      callId: "call_123",
      attemptId: "att_1",
      answered: true,
      voicemail: false,
      durationSec: 95,
      qualified: true,
      leadResponded: true,
      summary: "Clínica con 40 leads al mes, interesada.",
    });
  });

  it("acepta call_analysis en la raíz", () => {
    const { call_analysis, ...call } = sample.call;
    const r = parseDaptaWebhook({ call, call_analysis });
    expect("ambiguous" in r).toBe(false);
    if (!("ambiguous" in r)) expect(r.qualified).toBe(true);
  });

  it("sin call_id es ambiguo, nunca se adivina", () => {
    expect(parseDaptaWebhook({ foo: 1 })).toMatchObject({ ambiguous: true });
  });

  it("buzón y no contestada", () => {
    const vm = parseDaptaWebhook({ call: { ...sample.call, call_analysis: { in_voicemail: true } } });
    if (!("ambiguous" in vm)) expect(vm.voicemail).toBe(true);
    const na = parseDaptaWebhook({ call: { call_id: "x", call_status: "not_connected", disconnection_reason: "dial_no_answer" } });
    if (!("ambiguous" in na)) expect(na).toMatchObject({ answered: false, qualified: null, attemptId: null });
  });
});

describe("authorizeDaptaWebhook", () => {
  const opts = { secret: "s3cret", allowedIps: ["3.135.117.63", "3.14.139.223"] };
  it("exige secreto e IP permitida", () => {
    expect(authorizeDaptaWebhook(new Headers({ "x-faro-secret": "s3cret", "x-forwarded-for": "3.135.117.63" }), opts)).toBe(true);
    expect(authorizeDaptaWebhook(new Headers({ "x-faro-secret": "mal", "x-forwarded-for": "3.135.117.63" }), opts)).toBe(false);
    expect(authorizeDaptaWebhook(new Headers({ "x-faro-secret": "s3cret", "x-forwarded-for": "1.2.3.4" }), opts)).toBe(false);
    expect(authorizeDaptaWebhook(new Headers({ "x-faro-secret": "" }), { secret: "", allowedIps: [] })).toBe(false);
  });
});

describe("FakeQualifier", () => {
  it("registra las llamadas", async () => {
    const q = new FakeQualifier();
    await q.callNow({ attemptId: "a", phoneE164: "+573001112233", vars: { faro_attempt_id: "a", brand: "Faro", offer: "x", dossier_summary: "", opening_check: "requested", language: "es-CO" } });
    expect(q.calls).toHaveLength(1);
  });
});
