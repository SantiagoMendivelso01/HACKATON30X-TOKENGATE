import { describe, expect, it } from "vitest";
import { dedupe, type Candidate } from "./dedupe";

const base = (over: Partial<Candidate>): Candidate => ({
  source: "open_data",
  externalId: Math.random().toString(36),
  name: "Empresa",
  isLegalEntity: true,
  ...over,
});

describe("dedupe", () => {
  it("fusiona SECOP y RUES por NIT", () => {
    const out = dedupe([
      base({ externalId: "secop-1", nit: "900430348", email: "info@sonrisa.co", phoneE164: "+576013786137" }),
      base({ externalId: "rues-1", nit: "900430348", ciiu: "8622" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].persist).toMatchObject({ nit: "900430348", ciiu: "8622", email: "info@sonrisa.co" });
    expect(out[0].matchedBy).toBe("nit");
  });

  it("fusiona Places con datos abiertos por teléfono, sin persistir datos de Places", () => {
    const out = dedupe([
      base({ externalId: "secop-1", nit: "900430348", name: "Sonrisa SAS" }),
      base({ source: "places", externalId: "place-abc", name: "Clínica Sonrisa", phoneE164: "+576013786137", domain: "sonrisa.co" }),
      base({ externalId: "secop-1b", nit: "900430348", phoneE164: "+576013786137" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].foundBy).toEqual(["open_data", "places"]);
    expect(out[0].persist.placeId).toBe("place-abc");
    // El dominio solo vino de Places: no se guarda.
    expect(out[0].persist.domain).toBeNull();
    expect(out[0].persist.phoneE164).toBe("+576013786137");
  });

  it("fusiona por dominio y por nombre + ciudad", () => {
    const out = dedupe([
      base({ externalId: "a", domain: "dentix.co" }),
      base({ source: "places", externalId: "p1", domain: "dentix.co" }),
      base({ externalId: "b", name: "Clínica Dental Bella S.A.S.", city: "BOGOTa" }),
      base({ source: "places", externalId: "p2", name: "Clinica dental bella", city: "Bogotá" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((l) => l.matchedBy).sort()).toEqual(["domain", "name_city"]);
  });

  it("no fusiona dos NIT distintos aunque compartan conmutador", () => {
    const out = dedupe([
      base({ externalId: "a", nit: "900000001", phoneE164: "+576011111111" }),
      base({ externalId: "b", nit: "900000002", phoneE164: "+576011111111" }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("persona natural en cualquier fuente almacenable gana", () => {
    const out = dedupe([
      base({ externalId: "a", nit: "123456789", isLegalEntity: true }),
      base({ externalId: "b", nit: "123456789", isLegalEntity: false }),
    ]);
    expect(out[0].persist.isLegalEntity).toBe(false);
  });
});
