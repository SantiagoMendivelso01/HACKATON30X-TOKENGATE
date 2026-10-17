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
