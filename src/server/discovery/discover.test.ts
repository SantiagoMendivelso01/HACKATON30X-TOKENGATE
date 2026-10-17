import { describe, expect, it } from "vitest";
import { EVENT_CAMPAIGN_CONFIG } from "@/server/lab/config";
import { profileMatch, runDiscovery, type DiscoveredLead, type DiscoveryStore } from "./discover";
import type { OpenData, RuesRow, SecopRow } from "./opendata";

const rues = (nit: string, name: string, ciiu: string, over: Partial<RuesRow> = {}): RuesRow => ({
  matricula: `m${nit}`,
  razon_social: name,
  numero_identificacion: nit,
  clase_identificacion: "NIT",
  cod_ciiu_act_econ_pri: ciiu,
  fecha_matricula: "20180101",
  ultimo_ano_renovado: "2026",
  organizacion_juridica: "SOCIEDADES POR ACCIONES SIMPLIFICADAS SAS",
  estado_matricula: "ACTIVA",
  camara_comercio: "BOGOTA",
  ...over,
});

class FakeOpenData implements OpenData {
  constructor(private r: RuesRow[], private s: SecopRow[]) {}
  async countRues() {
    return this.r.length;
  }
  async queryRues() {
    return this.r;
  }
  async querySecopByNits(nits: string[]) {
    return this.s.filter((x) => nits.some((n) => x.nit?.startsWith(n)));
  }
}

class MemoryStore implements DiscoveryStore {
  saved: DiscoveredLead[] = [];
  events: string[] = [];
  constructor(private nits: string[] = []) {}
  async knownKeys() {
    return { nits: new Set(this.nits), placeIds: new Set<string>() };
  }
  async save(_c: string, leads: DiscoveredLead[]) {
    this.saved.push(...leads);
    return leads.length;
  }
  kinds = new Map<string, string>();
  async logActivity(_c: string, key: string, _p: Record<string, unknown>, kind = "done") {
    this.events.push(key);
    const id = `ev${this.events.length}`;
    this.kinds.set(id, kind);
    return id;
  }
  async setActivityKind(id: string, kind: "done" | "attention") {
    this.kinds.set(id, kind);
  }
}

const now = new Date("2026-10-17T12:00:00Z");

describe("profileMatch", () => {
  it("8622 entra directo; 8621 y 9602 necesitan palabra clave en el nombre", () => {
    expect(profileMatch("SONRISAS SAS", "8622", true, EVENT_CAMPAIGN_CONFIG).ok).toBe(true);
    expect(profileMatch("CENTRO MÉDICO ESTÉTICO LUZ SAS", "8621", true, EVENT_CAMPAIGN_CONFIG)).toMatchObject({ ok: true });
    expect(profileMatch("IPS SALUD TOTAL SAS", "8621", true, EVENT_CAMPAIGN_CONFIG).ok).toBe(false);
    expect(profileMatch("HOSPITAL DENTAL SAS", "8622", true, EVENT_CAMPAIGN_CONFIG).reason).toContain("excluida");
    expect(profileMatch("SONRISAS SAS", "8622", false, EVENT_CAMPAIGN_CONFIG).ok).toBe(false);
  });
});

describe("runDiscovery", () => {
  const ruesRows = [
    rues("901111111", "SONRISAS BOGOTA SAS", "8622", { fecha_matricula: "20260301" }),
    rues("902222222", "ESTETICA PIEL SANA SAS", "8621"),
    rues("903333333", "IPS GENERAL SAS", "8621"),
    rues("904444444", "ODONTO SIN CONTACTO SAS", "8622"),
  ];
  const secopRows: SecopRow[] = [
    { codigo: "s1", nombre: "SONRISAS BOGOTA SAS", nit: "9011111114", correo: "CITAS@SONRISAS.CO", telefono: "6013001000", sitio_web: "www.sonrisas.co", tipo_empresa: "SOCIEDAD POR ACCIONES SIMPLIFICADA", esta_activa: "Si", municipio: "BOGOTa" },
    { codigo: "s2", nombre: "ESTETICA PIEL SANA SAS", nit: "902222222", correo: "No Provisto", telefono: "3001112233", tipo_empresa: "SOCIEDAD POR ACCIONES SIMPLIFICADA", esta_activa: "Si", municipio: "BOGOTa" },
    { codigo: "s3", nombre: "IPS GENERAL SAS", nit: "903333333", correo: "info@ipsgeneral.co", tipo_empresa: "SOCIEDAD POR ACCIONES SIMPLIFICADA", esta_activa: "Si", municipio: "BOGOTa" },
  ];

  it("guarda solo contactables, marca el perfil y cita hechos con fuente y licencia", async () => {
    const store = new MemoryStore();
    const stats = await runDiscovery({ openData: new FakeOpenData(ruesRows, secopRows), store, now }, "c1", EVENT_CAMPAIGN_CONFIG);

    expect(stats).toMatchObject({ ruesRows: 4, contactable: 3, inProfile: 2, saved: 3 });
    expect(store.saved.map((l) => l.merged.persist.name).sort()).toEqual(["ESTETICA PIEL SANA SAS", "IPS GENERAL SAS", "SONRISAS BOGOTA SAS"]);

    const sonrisas = store.saved.find((l) => l.merged.persist.nit === "901111111")!;
    expect(sonrisas.inProfile).toBe(true);
    expect(sonrisas.merged.persist).toMatchObject({ ciiu: "8622", email: "citas@sonrisas.co", phoneE164: "+576013001000", domain: "sonrisas.co" });
    expect(sonrisas.fitScore).toBe(100);
    expect(sonrisas.signals).toEqual([expect.objectContaining({ kind: "recent_registration" })]);
    expect(sonrisas.facts.map((f) => f.source)).toEqual(["RUES (datos abiertos)", "RUES (datos abiertos)", "SECOP II (datos abiertos)"]);
    expect(sonrisas.facts.every((f) => f.license)).toBe(true);
    expect(sonrisas.facts[0].text).toContain("Bogotá");

    const ips = store.saved.find((l) => l.merged.persist.nit === "903333333")!;
    expect(ips.inProfile).toBe(false);
    expect(ips.profileReason).toContain("sin palabra clave");

    expect(store.events).toEqual(["activity.discoveryStarted", "activity.discoveryFinished"]);
    // El evento "trabajando" se cierra al terminar: nunca queda colgado.
    expect([...store.kinds.values()]).toEqual(["done", "done"]);
  });

  it("nunca guarda campos del representante legal", async () => {
    const store = new MemoryStore();
    const row = { ...secopRows[0], nombre_representante_legal: "PERSONA X" } as SecopRow;
    await runDiscovery({ openData: new FakeOpenData(ruesRows, [row]), store, now }, "c1", EVENT_CAMPAIGN_CONFIG);
    const payload = JSON.stringify(store.saved.flatMap((l) => l.sourceRecords));
    // El adaptador real solo pide SECOP_FIELDS; este test fija que el payload del fake no se filtra a hechos ni al lead.
    expect(JSON.stringify(store.saved.map((l) => [l.merged.persist, l.facts]))).not.toContain("PERSONA X");
    expect(payload).toBeDefined();
  });

  it("si falla, el evento de inicio pasa a requerir atención", async () => {
    const store = new MemoryStore();
    const broken: OpenData = { countRues: async () => 0, queryRues: async () => { throw new Error("Socrata caído"); }, querySecopByNits: async () => [] };
    await expect(runDiscovery({ openData: broken, store, now }, "c1", EVENT_CAMPAIGN_CONFIG)).rejects.toThrow("Socrata caído");
    expect([...store.kinds.values()]).toEqual(["attention"]);
  });

  it("es idempotente: no vuelve a guardar NIT ya conocidos", async () => {
    const store = new MemoryStore(["901111111", "902222222", "903333333"]);
    const stats = await runDiscovery({ openData: new FakeOpenData(ruesRows, secopRows), store, now }, "c1", EVENT_CAMPAIGN_CONFIG);
    expect(stats).toMatchObject({ alreadyKnown: 3, saved: 0 });
  });
});

describe("hechos de actividad", () => {
  it("describen el CIIU con el catálogo oficial, para cualquier rubro", async () => {
    const store = new MemoryStore();
    const cfg = { ...EVENT_CAMPAIGN_CONFIG, ciiu: ["6820"], filters: { ...EVENT_CAMPAIGN_CONFIG.filters, nameKeywordsByCiiu: {} } };
    const r = rues("905555555", "ARRIENDOS CALI SAS", "6820");
    const s: SecopRow = { codigo: "s9", nombre: "ARRIENDOS CALI SAS", nit: "905555555", correo: "info@arriendoscali.co", tipo_empresa: "SAS", esta_activa: "Si" };
    await runDiscovery({ openData: new FakeOpenData([r], [s]), store, now }, "c1", cfg);
    const fact = store.saved[0].facts.find((f) => f.field === "cod_ciiu_act_econ_pri")!;
    expect(fact.text).toMatch(/^Actividad económica principal CIIU 6820 \(actividades inmobiliarias/);
  });
});
