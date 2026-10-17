import { describe, expect, it } from "vitest";
import { checkClaims } from "@/server/messaging/claims";
import { registeredWithinMonths, ruesToCandidate, SECOP_FIELDS, secopToCandidate } from "./opendata";

describe("mapeo de datos abiertos", () => {
  it("SECOP: limpia contacto y nunca expone campos del representante legal", () => {
    expect(SECOP_FIELDS.some((f) => f.includes("representante"))).toBe(false);
    const c = secopToCandidate({
      codigo: "1",
      nombre: "GEOTOTAL SAS",
      nit: "9004303487",
      telefono: "6013786137",
      correo: "COORDINACION@GEOTOTAL.COM.CO",
      sitio_web: "No Provisto",
      municipio: "BOGOTa",
      tipo_empresa: "SOCIEDAD POR ACCIONES SIMPLIFICADA",
      esta_activa: "Si",
    });
    expect(c).toMatchObject({ nit: "900430348", phoneE164: "+576013786137", domain: "geototal.com.co", email: "coordinacion@geototal.com.co", isLegalEntity: true });
  });

  it("SECOP: persona natural no es persona jurídica", () => {
    expect(secopToCandidate({ codigo: "2", nombre: "JUAN", tipo_empresa: "PERSONA NATURAL COLOMBIANA" })?.isLegalEntity).toBe(false);
  });

  it("RUES: NIT, CIIU y matrícula reciente", () => {
    const c = ruesToCandidate({ matricula: "9", razon_social: "ORTHONAL SAS", numero_identificacion: "902112402", clase_identificacion: "NIT", cod_ciiu_act_econ_pri: "8622", organizacion_juridica: "SOCIEDADES POR ACCIONES SIMPLIFICADAS SAS", camara_comercio: "BOGOTA" });
    expect(c).toMatchObject({ nit: "902112402", ciiu: "8622", isLegalEntity: true });
    expect(registeredWithinMonths("20261002", 12, new Date("2026-10-17T00:00:00Z"))).toBe(true);
    expect(registeredWithinMonths("20200101", 12, new Date("2026-10-17T00:00:00Z"))).toBe(false);
  });
});

describe("verificador de afirmaciones", () => {
  const facts = [{ id: "f1", text: "Atiende sábados de 8 a 14", source: "web" }];
  const body = "Vimos que atienden los sábados. Le escribimos porque...";
  it("bloquea afirmaciones sin hecho o con hecho inexistente", () => {
    expect(checkClaims(body, [{ text: "atienden los sábados", factId: "f1" }], facts).ok).toBe(true);
    expect(checkClaims(body, [{ text: "atienden los sábados", factId: null }], facts).issues[0].problem).toBe("no_fact");
    expect(checkClaims(body, [{ text: "atienden los sábados", factId: "f9" }], facts).issues[0].problem).toBe("unknown_fact");
    expect(checkClaims(body, [{ text: "tienen 3 sedes", factId: "f1" }], facts).issues[0].problem).toBe("not_in_body");
    expect(checkClaims(body, [{ text: "atienden los sábados", factId: "f1" }], facts, { "atienden los sábados": false }).ok).toBe(false);
  });
});
