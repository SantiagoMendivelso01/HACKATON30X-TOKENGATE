import { describe, expect, it } from "vitest";
import { colombianHolidays } from "@/lib/colombia-time";
import { checkCompliance, withinLegalHours, type ComplianceInput } from "./compliance";

/** Hora local de Bogotá → Date (UTC−5). */
const bog = (iso: string) => new Date(`${iso}-05:00`);

const ok = (over: Partial<ComplianceInput> = {}): ComplianceInput => ({
  now: bog("2026-10-17T09:00:00"), // sábado del evento
  channel: "voice",
  lead: { isLegalEntity: true, phoneE164: "+576013786137", email: "info@x.co" },
  lastContactAt: null,
  excluded: false,
  budget: { spentUsd: 10, capUsd: 100, nextCostUsd: 1 },
  campaignPaused: false,
  armActive: true,
  ...over,
});

describe("festivos de Colombia", () => {
  it("2026 incluye los trasladados por la Ley Emiliani", () => {
    const h = colombianHolidays(2026);
    for (const d of ["2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25"]) {
      expect(h.has(d), d).toBe(true);
    }
    expect(h.has("2026-10-17")).toBe(false);
    expect(h.size).toBe(18);
  });
});

describe("horario legal", () => {
  it("sábado 8:00–15:00", () => {
    expect(withinLegalHours(bog("2026-10-17T07:59:00"))).toBe(false);
    expect(withinLegalHours(bog("2026-10-17T08:00:00"))).toBe(true);
    expect(withinLegalHours(bog("2026-10-17T14:59:00"))).toBe(true);
    expect(withinLegalHours(bog("2026-10-17T15:00:00"))).toBe(false);
  });
  it("entre semana 7:00–19:00", () => {
    expect(withinLegalHours(bog("2026-10-16T18:59:00"))).toBe(true);
    expect(withinLegalHours(bog("2026-10-16T19:00:00"))).toBe(false);
  });
  it("nunca domingos ni festivos", () => {
    expect(withinLegalHours(bog("2026-10-18T10:00:00"))).toBe(false);
    expect(withinLegalHours(bog("2026-10-12T10:00:00"))).toBe(false);
  });
});

describe("checkCompliance", () => {
  it("permite un contacto válido", () => {
    expect(checkCompliance(ok())).toEqual({ allowed: true, exception: null });
  });

  it("devuelve todos los motivos a la vez", () => {
    const r = checkCompliance(
      ok({
        now: bog("2026-10-17T16:00:00"),
        lastContactAt: bog("2026-10-14T10:00:00"),
        excluded: true,
        lead: { isLegalEntity: false, phoneE164: null, email: null },
        budget: { spentUsd: 99.5, capUsd: 100, nextCostUsd: 1 },
      }),
    );
    expect(r.allowed).toBe(false);
    if (!r.allowed)
      expect(r.reasons.sort()).toEqual(
        ["budget_exceeded", "contacted_last_7_days", "excluded", "missing_contact_data", "natural_person", "outside_hours"].sort(),
      );
  });

  it("el intervalo de 7 días cuenta cualquier canal", () => {
    expect(checkCompliance(ok({ lastContactAt: bog("2026-10-10T09:00:01") })).allowed).toBe(false);
    expect(checkCompliance(ok({ lastContactAt: bog("2026-10-10T09:00:00") })).allowed).toBe(true);
  });

  it("email sin dirección se bloquea", () => {
    const r = checkCompliance(ok({ channel: "email", lead: { isLegalEntity: true, phoneE164: "+576013786137", email: null } }));
    expect(r).toEqual({ allowed: false, reasons: ["missing_contact_data"] });
  });

  it("D53: llamada solicitada por el titular en el momento, el domingo de la demo", () => {
    const now = bog("2026-10-18T10:01:00");
    const r = checkCompliance(
      ok({ now, lastContactAt: bog("2026-10-17T09:00:00"), requestedByHolder: { consentAt: bog("2026-10-18T10:00:00") } }),
    );
    expect(r).toEqual({ allowed: true, exception: "requested_by_holder" });
  });

  it("D53 no exime de la exclusión ni del presupuesto, y exige consentimiento reciente", () => {
    const now = bog("2026-10-18T10:30:00");
    const stale = checkCompliance(ok({ now, requestedByHolder: { consentAt: bog("2026-10-18T10:00:00") } }));
    expect(stale.allowed).toBe(false);
    if (!stale.allowed) expect(stale.reasons).toContain("consent_stale");

    const excluded = checkCompliance(ok({ now, excluded: true, requestedByHolder: { consentAt: bog("2026-10-18T10:29:00") } }));
    expect(excluded).toEqual({ allowed: false, reasons: ["excluded"] });
  });

  it("pausas global y por brazo", () => {
    const r = checkCompliance(ok({ campaignPaused: true, armActive: false }));
    expect(r).toEqual({ allowed: false, reasons: ["campaign_paused", "arm_paused"] });
  });
});
