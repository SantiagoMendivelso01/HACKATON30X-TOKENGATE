import { describe, expect, it } from "vitest";
import { FakeLlm } from "@/server/llm/llm";
import { EVENT_CAMPAIGN_CONFIG } from "@/server/lab/config";
import { CAMARAS, CIIU_BY_CODE } from "./catalog";
import type { OpenData, RuesRow, SecopRow } from "./opendata";
import { previewCampaign } from "./preview";
import { proposalToConfig, proposeConfig, type Proposal } from "./propose";

const proposal: Proposal = {
  summary: "Talleres de mecánica automotriz en Medellín",
  city: "Medellín",
  ruesCamara: "medellin para antioquia",
  ciiu: [
    { code: "4520", reason: "Mantenimiento y reparación de vehículos" },
    { code: "9999", reason: "inventado" },
    { code: "abcd", reason: "basura" },
  ],
  nameKeywords: [{ code: "4520", keywords: ["taller", "Autos"] }],
  excludeKeywords: ["liquidacion"],
  placesQueries: ["taller mecánico en Medellín"],
  minRenewalYear: 2025,
};

describe("catálogos", () => {
  it("traen CIIU con descripción oficial y las cámaras del RUES", () => {
    expect(CIIU_BY_CODE.get("8622")?.label).toMatch(/odontol/i);
    expect(CAMARAS).toContain("BOGOTA");
    expect(CAMARAS).toContain("MEDELLIN PARA ANTIOQUIA");
  });
});

describe("proposalToConfig", () => {
  it("descarta CIIU y cámaras inexistentes y normaliza palabras clave", () => {
    const { config, dropped, reasons } = proposalToConfig(proposal, "talleres en Medellín");
    expect(config.ciiu).toEqual(["4520"]);
    expect(config.ruesCamara).toBe("MEDELLIN PARA ANTIOQUIA");
    expect(config.filters.nameKeywordsByCiiu).toEqual({ "4520": ["TALLER", "AUTOS"] });
    expect(config.filters.excludeKeywords).toEqual(["LIQUIDACION"]);
    expect(dropped).toEqual(["CIIU 9999", "CIIU abcd"]);
    expect(reasons["4520"]).toContain("reparación");
  });

  it("sin ningún CIIU válido no inventa configuración", async () => {
    const llm = new FakeLlm({ propose_campaign: { ...proposal, ciiu: [{ code: "9999", reason: "x" }], nameKeywords: [] } });
    const r = await proposeConfig(llm, "algo raro");
    expect(r.config).toBeNull();
    expect(r.dropped).toEqual(["CIIU 9999"]);
  });

  it("propone con el modelo redactor y devuelve el uso para el libro de costos", async () => {
    const llm = new FakeLlm({ propose_campaign: proposal });
    const r = await proposeConfig(llm, "talleres en Medellín");
    expect(r.config?.ciiu).toEqual(["4520"]);
    expect(r.llm).toMatchObject({ model: "claude-sonnet-5-5", valid: true });
    expect(llm.calls[0].system).toContain("4520");
  });
});

describe("previewCampaign", () => {
  const rues = (nit: string, name: string, ciiu: string): RuesRow => ({
    matricula: nit,
    razon_social: name,
    numero_identificacion: nit,
    clase_identificacion: "NIT",
    cod_ciiu_act_econ_pri: ciiu,
    organizacion_juridica: "SAS",
    camara_comercio: "BOGOTA",
  });
  const open: OpenData = {
    countRues: async ({ ciiu }) => (ciiu === "8622" ? 600 : 3000),
    queryRues: async ({ ciiu }) =>
      ciiu[0] === "8622"
        ? [rues("901000001", "SONRISAS SAS", "8622"), rues("902000001", "DENTAL SAS", "8622"), rues("903000001", "ODONTO SAS", "8622"), rues("904000001", "BOCA SAS", "8622")]
        : [rues("911000001", "CARDIO SAS", "8621"), rues("912000001", "ESTETICA LUZ SAS", "8621")],
    querySecopByNits: async (nits) =>
      (
        [
          { codigo: "a", nombre: "SONRISAS SAS", nit: "901000001", correo: "a@sonrisas.co" },
          { codigo: "b", nombre: "CARDIO SAS", nit: "911000001", telefono: "6013001000" },
          { codigo: "c", nombre: "ESTETICA LUZ SAS", nit: "912000001", telefono: "6013001001" },
        ] as SecopRow[]
      ).filter((r) => nits.includes(r.nit!)),
  };

  it("extrapola contactables y del perfil desde la muestra y estima el costo", async () => {
    const p = await previewCampaign(open, EVENT_CAMPAIGN_CONFIG);
    const dental = p.rows.find((r) => r.code === "8622")!;
    expect(dental).toMatchObject({ ruesCompanies: 600, sampled: 4, contactableEstimate: 150, inProfileEstimate: 150 });
    const medical = p.rows.find((r) => r.code === "8621")!;
    expect(medical).toMatchObject({ contactableEstimate: 3000, inProfileEstimate: 1500 });
    expect(p.cost.placesRequests).toBe(EVENT_CAMPAIGN_CONFIG.placesQueries.length * 3);
    expect(p.neededForTwoWaves).toBe(180);
  });
});
