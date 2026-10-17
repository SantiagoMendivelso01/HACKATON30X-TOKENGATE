import { describe, expect, it } from "vitest";
import { daptaCallCost, daptaCallCredits, llmCost, type CostEntry } from "@/server/costs/ledger";
import { allocate, quotas, type AllocatableLead } from "./allocation";
import { ALL_ARMS, armId, DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, type ArmKey } from "./config";
import { classifyCall, classifyReply } from "./funnel";
import { computeMetrics, matureEvidence, prorateFixed, type LeadOutcomeRow } from "./metrics";
import { channelShares, extractNumbers, templateRecommendation, verifyNumbers } from "./recommendation";
import { sampleBeta, seededRng, wilson } from "./stats";
import { applyFloor, thompson, uniformMix, type ArmEvidence } from "./thompson";

describe("estadística", () => {
  it("Wilson al 90%", () => {
    const w = wilson(3, 15);
    expect(w.p).toBeCloseTo(0.2);
    expect(w.low).toBeCloseTo(0.0829, 3);
    expect(w.high).toBeCloseTo(0.4088, 3);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1, p: 0 });
  });
  it("la media de Beta(a, b) es a/(a+b)", () => {
    const rng = seededRng(1);
    let s = 0;
    for (let i = 0; i < 20000; i++) s += sampleBeta(3, 7, rng);
    expect(s / 20000).toBeCloseTo(0.3, 2);
  });
});

const ev = (arm: ArmKey, over: Partial<ArmEvidence> = {}): ArmEvidence => ({
  arm,
  active: true,
  matureContacts: 15,
  conversations: 2,
  qualified: 0,
  rejections: 1,
  costUsd: 1.5,
  priorCostPerContactUsd: 0.1,
  ...over,
});

describe("Thompson", () => {
  it("favorece al brazo claramente mejor y apaga al malo con contactos suficientes", () => {
    const arms = ALL_ARMS.map((a) =>
      a.channel === "voice_direct" && a.source === "open_data"
        ? ev(a, { conversations: 10, qualified: 5, rejections: 0, costUsd: 1.5 })
        : a.channel === "email_simple" && a.source === "places"
          ? ev(a, { conversations: 0, qualified: 0, rejections: 6, costUsd: 3 })
          : ev(a),
    );
    const r = thompson(arms, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, seededRng(42));
    expect(r.leader).toBe("open_data:voice_direct");
    expect(r.pBest["open_data:voice_direct"]).toBeGreaterThan(0.95);
    expect(r.turnedOff).toContain("places:email_simple");
    expect(r.mix["places:email_simple"]).toBe(0);
    expect(r.evidence).toBe("strong");
    const active = Object.entries(r.mix).filter(([, v]) => v > 0);
    expect(active.every(([, v]) => v >= 0.1 - 1e-9)).toBe(true);
    expect(active.reduce((s, [, v]) => s + v, 0)).toBeCloseTo(1);
  });

  it("evidencia insuficiente si algún brazo activo tiene < 10 contactos maduros", () => {
    const arms = ALL_ARMS.map((a, i) => ev(a, { matureContacts: i === 0 ? 4 : 15 }));
    expect(thompson(arms, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, seededRng(1)).evidence).toBe("insufficient");
  });

  it("no apaga con pocos contactos aunque P(mejor) sea baja", () => {
    const arms = ALL_ARMS.map((a, i) => ev(a, i === 0 ? { matureContacts: 12, conversations: 0, rejections: 6 } : {}));
    expect(thompson(arms, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, seededRng(3)).turnedOff).toEqual([]);
  });

  it("applyFloor respeta el mínimo y suma 1", () => {
    const m = applyFloor({ a: 0.9, b: 0.08, c: 0.02 }, 0.1);
    expect(m.b).toBeCloseTo(0.1);
    expect(m.c).toBeCloseTo(0.1);
    expect(m.a).toBeCloseTo(0.8);
  });
});

describe("asignación", () => {
  const leads: AllocatableLead[] = Array.from({ length: 90 }, (_, i) => ({
    id: `l${i}`,
    foundBy: i % 10 === 0 ? ["open_data", "places"] : i % 2 ? ["open_data"] : ["places"],
    assignedSource: null,
    hasEmail: i % 7 !== 0,
    hasPhone: true,
  }));

  it("cuotas por resto mayor suman el total", () => {
    const q = quotas(10, { a: 1, b: 1, c: 1 });
    expect(Object.values(q).reduce((s, v) => s + v, 0)).toBe(10);
  });

  it("oleada 1 uniforme: reparte por igual y respeta la elegibilidad del canal", () => {
    const { assignments, unassigned } = allocate(leads, uniformMix(ALL_ARMS), seededRng(7));
    expect(unassigned).toEqual([]);
    expect(assignments).toHaveLength(90);
    const byArm = new Map<string, number>();
    for (const a of assignments) byArm.set(armId(a), (byArm.get(armId(a)) ?? 0) + 1);
    for (const n of byArm.values()) expect(n).toBeGreaterThanOrEqual(10);
    const noEmail = new Set(leads.filter((l) => !l.hasEmail).map((l) => l.id));
    expect(assignments.filter((a) => noEmail.has(a.leadId)).every((a) => a.channel === "voice_direct")).toBe(true);
  });

  it("la fuente sale de found_by y se respeta si ya se sorteó", () => {
    const { assignments } = allocate(
      [{ id: "x", foundBy: ["open_data", "places"], assignedSource: "places", hasEmail: true, hasPhone: true }],
      uniformMix(ALL_ARMS),
      seededRng(1),
    );
    expect(assignments[0].source).toBe("places");
  });

  it("no asigna a brazos apagados (mezcla 0)", () => {
    const mix = { ...uniformMix(ALL_ARMS), "open_data:voice_direct": 0, "places:voice_direct": 0 };
    const { assignments } = allocate(leads, mix, seededRng(2));
    expect(assignments.some((a) => a.channel === "voice_direct")).toBe(false);
  });
});

describe("costos de Dapta", () => {
  it("333 créditos por minuto contestado con redondeo al minuto", () => {
    expect(daptaCallCredits({ answered: true, voicemail: false, durationSec: 61 })).toEqual({ credits: 666, minutes: 2, estimated: false });
    expect(daptaCallCredits({ answered: true, voicemail: true, durationSec: 20 }).credits).toBe(75);
    expect(daptaCallCredits({ answered: false, voicemail: false, durationSec: null }).credits).toBe(45);
    expect(daptaCallCredits({ answered: true, voicemail: false, durationSec: null }).estimated).toBe(true);
  });
  it("asiento con precio de lista y evidencia", () => {
    const e = daptaCallCost({ campaignId: "c", fxCopPerUsd: 4000 }, { answered: true, voicemail: false, durationSec: 95 }, "call_1");
    expect(e).toMatchObject({ kind: "dapta_call_minutes", quantity: 666, listAmountUsd: 0.666, actualAmountUsd: 0.666 });
    expect(e.evidence).toContain("call_1");
  });
});

describe("embudo", () => {
  it("conversación real: humano, sin buzón, ≥ 30 s y con respuesta del lead", () => {
    expect(classifyCall({ answered: true, voicemail: false, durationSec: 45, leadResponded: true, qualified: true })).toEqual({
      realConversation: true,
      qualified: true,
      rejection: null,
    });
    expect(classifyCall({ answered: true, voicemail: true, durationSec: 45, leadResponded: true, qualified: null }).realConversation).toBe(false);
    expect(classifyCall({ answered: true, voicemail: false, durationSec: 6, leadResponded: false, qualified: null }).rejection).toBe("early_hangup");
  });
  it("respuestas de email", () => {
    expect(classifyReply({ class: "auto", hostile: false, unsubscribe: false }).realConversation).toBe(false);
    expect(classifyReply({ class: "human", hostile: false, unsubscribe: true })).toEqual({ realConversation: false, rejection: "opt_out" });
  });
});

describe("métricas y frase", () => {
  const now = new Date("2026-10-17T16:00:00Z"); // 11:00 en Bogotá
  const contacted = new Date("2026-10-17T13:00:00Z"); // 8:00 en Bogotá
  const voice: ArmKey = { source: "open_data", channel: "voice_direct" };
  const email: ArmKey = { source: "places", channel: "email_simple" };
  const rows: LeadOutcomeRow[] = [
    { leadId: "a", foundBy: ["open_data"], inProfile: true, arm: voice, contactedAt: contacted, realConversationAt: contacted, qualifiedAt: contacted, rejectedAt: null },
    { leadId: "b", foundBy: ["open_data", "places"], inProfile: true, arm: voice, contactedAt: contacted, realConversationAt: null, qualifiedAt: null, rejectedAt: null },
    { leadId: "c", foundBy: ["places"], inProfile: true, arm: email, contactedAt: contacted, realConversationAt: null, qualifiedAt: null, rejectedAt: contacted },
    { leadId: "d", foundBy: ["places"], inProfile: false, arm: null, contactedAt: null, realConversationAt: null, qualifiedAt: null, rejectedAt: null },
  ];
  const ctx = { campaignId: "c", fxCopPerUsd: 4000 };
  const costs: CostEntry[] = [
    { ...daptaCallCost({ ...ctx, leadId: "a", ...voice }, { answered: true, voicemail: false, durationSec: 100 }, "1") },
    { ...daptaCallCost({ ...ctx, leadId: "b", ...voice }, { answered: false, voicemail: false, durationSec: null }, "2") },
    { ...llmCost({ ...ctx, source: "places" }, "claude-haiku-5-5", 100_000, 0, "score") },
  ];

  it("CPQL, CPL bruto e incremental", () => {
    const m = computeMetrics(rows, costs, { view: "variable" });
    const v = m.arms.find((a) => a.id === "open_data:voice_direct")!;
    expect(v.contacted).toBe(2);
    expect(v.qualified).toBe(1);
    expect(v.cpql.value).toBeCloseTo(0.666 + 0.045);
    const places = m.sources.find((s) => s.source === "places")!;
    expect(places.inProfile).toBe(2);
    expect(places.exclusive).toBe(1);
    expect(places.cplGross.value).toBeCloseTo(0.005);
    expect(places.cplIncremental.value).toBeCloseTo(0.01);
    expect(m.arms.find((a) => a.id === "open_data:email_simple")!.cpql.value).toBeNull();
  });

  it("los fijos solo entran en la vista total y se imputan por alcance", () => {
    const fixed = prorateFixed([{ amountUsd: 10, scope: "voice" }], { "open_data:voice_direct": 2, "places:voice_direct": 0 });
    expect(fixed["open_data:voice_direct"]).toBe(10);
    expect(fixed["places:email_simple"]).toBe(0);
    const total = computeMetrics(rows, costs, { view: "total", fixed: [{ amountUsd: 10, scope: "voice" }] });
    expect(total.arms.find((a) => a.id === "open_data:voice_direct")!.costUsd).toBeCloseTo(10.711);
  });

  it("madurez de 3 h", () => {
    const active = new Set(ALL_ARMS.map(armId));
    const early = matureEvidence(rows, costs, new Date("2026-10-17T15:59:00Z"), 3, active, () => 0.1);
    expect(early.every((a) => a.matureContacts === 0)).toBe(true);
    const mature = matureEvidence(rows, costs, now, 3, active, () => 0.1);
    expect(mature.find((a) => armId(a.arm) === "open_data:voice_direct")).toMatchObject({ matureContacts: 2, qualified: 1 });
  });

  it("frase por plantilla con cifras verificables", () => {
    const m = computeMetrics(rows, costs, { view: "variable" });
    const arms = ALL_ARMS.map((a) => ev(a, a.channel === "voice_direct" ? { conversations: 8, qualified: 4, rejections: 0 } : {}));
    const t = thompson(arms, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, seededRng(9));
    const r = templateRecommendation(m, t, 4000);
    expect(r.text).toMatch(/^Busca en datos abiertos: cada lead del perfil te cuesta \$0 COP \(incremental\)\./);
    expect(r.text).toContain("Contacta por voz");
    expect(r.text).toContain("Evidencia: ");
    expect(verifyNumbers(r.text, r.numbers)).toEqual({ ok: true, unknown: [] });
    expect(verifyNumbers(r.text.replace(/\d+% de probabilidad/, "99% de probabilidad"), r.numbers).ok).toBe(false);
    const mix = channelShares(t.mix);
    expect(mix.email_simple + mix.email_diagnostic + mix.voice_direct).toBe(100);
  });

  it("extrae cifras en formato colombiano", () => {
    expect(extractNumbers("cuesta $1.200 COP, 72% y 38 contactos.")).toEqual(["$1.200", "72%", "38"]);
  });
});
