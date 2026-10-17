import { describe, expect, it } from "vitest";
import { decideNextAction } from "./bridge";

describe("decideNextAction", () => {
  const base = { waves: [] as { n: number; status: string }[], inProfileUnassigned: 21, inProfileTotal: 21, waveSize: 90 };

  it("recién descubierta: armar la oleada 1", () => {
    expect(decideNextAction(base)).toEqual({ kind: "buildWave", n: 1, available: 21, waveSize: 90 });
  });
  it("una oleada en revisión manda sobre todo lo demás", () => {
    expect(decideNextAction({ ...base, waves: [{ n: 1, status: "sent" }, { n: 2, status: "review" }] })).toEqual({ kind: "reviewWave", n: 2 });
  });
  it("redactando", () => {
    expect(decideNextAction({ ...base, waves: [{ n: 1, status: "composing" }] })).toEqual({ kind: "composingWave", n: 1 });
  });
  it("tras la oleada 1, la siguiente es la 2", () => {
    expect(decideNextAction({ ...base, waves: [{ n: 1, status: "sent" }], inProfileUnassigned: 40 })).toMatchObject({ kind: "buildWave", n: 2 });
  });
  it("sin leads del perfil: buscar leads; todos asignados: nada", () => {
    expect(decideNextAction({ ...base, inProfileTotal: 0, inProfileUnassigned: 0 })).toEqual({ kind: "findLeads" });
    expect(decideNextAction({ ...base, waves: [{ n: 1, status: "sent" }], inProfileUnassigned: 0 })).toEqual({ kind: "none" });
  });
});

import { campaignProgress } from "./bridge";

describe("campaignProgress", () => {
  const base = { found: 51, waves: [] as { n: number; status: string }[], contactedAt: [] as Date[], matureContacts: 0, maturationHours: 3 };
  it("avanza por las fases de la campaña", () => {
    expect(campaignProgress({ ...base, found: 0 }).current).toBe("leads");
    expect(campaignProgress(base).current).toBe("wave");
    expect(campaignProgress({ ...base, waves: [{ n: 1, status: "review" }] }).current).toBe("review");
    expect(campaignProgress({ ...base, waves: [{ n: 1, status: "approved" }] }).current).toBe("send");
    const c = new Date("2026-10-17T13:00:00Z");
    const waiting = campaignProgress({ ...base, waves: [{ n: 1, status: "sent" }], contactedAt: [c] });
    expect(waiting).toEqual({ current: "results", firstMatureAt: new Date("2026-10-17T16:00:00Z") });
    expect(campaignProgress({ ...base, contactedAt: [c], matureContacts: 10 }).current).toBe("decide");
  });
});
