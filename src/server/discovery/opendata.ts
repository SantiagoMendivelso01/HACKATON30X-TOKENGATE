// Adaptador OpenData (datos.gov.co, Socrata). RUES `c82u-588k` da CIIU y estado; SECOP II
// `qmzu-gj57` da el contacto. Nunca se leen ni guardan los campos `*_representante_legal`.
import { cleanText, extractDomain, nitCheckDigit as nitDv, normalizeEmail, normalizeNit, toE164 } from "@/lib/normalize";
import type { Candidate } from "./dedupe";

const BASE = "https://www.datos.gov.co/resource";
export const RUES_DATASET = "c82u-588k";
export const SECOP_DATASET = "qmzu-gj57";
export const SECOP_LICENSE = "CC BY-SA 4.0 (datos.gov.co, SECOP II Proveedores)";
export const RUES_LICENSE = "Datos abiertos, Confecámaras (RUES)";

/** Campos permitidos de SECOP: lista cerrada, sin representante legal. */
export const SECOP_FIELDS = ["codigo", "nombre", "nit", "esta_activa", "telefono", "correo", "sitio_web", "municipio", "departamento", "tipo_empresa", "espyme"] as const;
export const RUES_FIELDS = ["matricula", "razon_social", "numero_identificacion", "clase_identificacion", "cod_ciiu_act_econ_pri", "fecha_matricula", "ultimo_ano_renovado", "organizacion_juridica", "estado_matricula", "camara_comercio"] as const;

export type SecopRow = Partial<Record<(typeof SECOP_FIELDS)[number], string>>;
export type RuesRow = Partial<Record<(typeof RUES_FIELDS)[number], string>>;

const NATURAL_PERSON = /PERSONA NATURAL|EMPRESARIO INDIVIDUAL|EMPRES[AÁ]RIO EM NOME/i;

const soqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

export interface OpenData {
  countRues(params: { ciiu: string; camara: string; minRenewalYear?: number }): Promise<number>;
  queryRues(params: { ciiu: string[]; camara: string; minRenewalYear?: number; limit: number }): Promise<RuesRow[]>;
  querySecopByNits(nits: string[]): Promise<SecopRow[]>;
}

export class SocrataOpenData implements OpenData {
  constructor(private appToken?: string) {}

  private async get<T>(dataset: string, query: string): Promise<T[]> {
    const url = `${BASE}/${dataset}.json?$query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: this.appToken ? { "X-App-Token": this.appToken } : {},
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Socrata ${dataset} ${res.status}: ${await res.text()}`);
    return (await res.json()) as T[];
  }

  private ruesWhere(ciiu: string[], camara: string, minRenewalYear?: number) {
    return [
      `cod_ciiu_act_econ_pri in (${ciiu.map(soqlString).join(", ")})`,
      `estado_matricula = 'ACTIVA'`,
      `organizacion_juridica != 'PERSONA NATURAL'`,
      `camara_comercio = ${soqlString(camara)}`,
      minRenewalYear ? `ultimo_ano_renovado >= ${soqlString(String(minRenewalYear))}` : null,
    ]
      .filter(Boolean)
      .join(" AND ");
  }

  async countRues({ ciiu, camara, minRenewalYear }: Parameters<OpenData["countRues"]>[0]) {
    const [row] = await this.get<{ n: string }>(RUES_DATASET, `SELECT count(*) AS n WHERE ${this.ruesWhere([ciiu], camara, minRenewalYear)}`);
    return Number(row?.n ?? 0);
  }

  queryRues({ ciiu, camara, minRenewalYear, limit }: Parameters<OpenData["queryRues"]>[0]) {
    return this.get<RuesRow>(
      RUES_DATASET,
      `SELECT ${RUES_FIELDS.join(", ")} WHERE ${this.ruesWhere(ciiu, camara, minRenewalYear)} ORDER BY fecha_matricula DESC LIMIT ${limit}`,
    );
  }

  async querySecopByNits(nits: string[]) {
    const out: SecopRow[] = [];
    // SECOP guarda el NIT con o sin DV: se consultan ambas formas.
    for (let i = 0; i < nits.length; i += 100) {
      const chunk = nits.slice(i, i + 100);
      const variants = chunk.flatMap((n) => [n, `${n}${nitDv(n)}`]);
      out.push(...(await this.get<SecopRow>(SECOP_DATASET, `SELECT ${SECOP_FIELDS.join(", ")} WHERE nit in (${variants.map(soqlString).join(", ")}) LIMIT 1000`)));
    }
    return out;
  }
}

export function ruesToCandidate(r: RuesRow): Candidate | null {
  if (!r.razon_social || !r.matricula) return null;
  const isNit = /NIT/i.test(r.clase_identificacion ?? "");
  return {
    source: "open_data",
    externalId: `rues:${r.camara_comercio}:${r.matricula}`,
    name: r.razon_social,
    nit: isNit ? normalizeNit(r.numero_identificacion) : null,
    city: r.camara_comercio ?? null,
    ciiu: r.cod_ciiu_act_econ_pri ?? null,
    isLegalEntity: isNit && !NATURAL_PERSON.test(r.organizacion_juridica ?? ""),
  };
}

export function secopToCandidate(r: SecopRow): Candidate | null {
  if (!r.nombre || !r.codigo) return null;
  const email = normalizeEmail(r.correo);
  return {
    source: "open_data",
    externalId: `secop:${r.codigo}`,
    name: r.nombre,
    nit: normalizeNit(r.nit),
    city: cleanText(r.municipio),
    phoneE164: toE164(r.telefono),
    domain: extractDomain(r.sitio_web) ?? extractDomain(email),
    email,
    isLegalEntity: !NATURAL_PERSON.test(r.tipo_empresa ?? "") && r.esta_activa !== "No",
  };
}

/** Fecha de matrícula RUES (YYYYMMDD) → señal "matrícula reciente" (D51). */
export function registeredWithinMonths(fechaMatricula: string | undefined, months: number, now: Date): boolean {
  if (!fechaMatricula || !/^\d{8}$/.test(fechaMatricula)) return false;
  const d = new Date(Date.UTC(+fechaMatricula.slice(0, 4), +fechaMatricula.slice(4, 6) - 1, +fechaMatricula.slice(6, 8)));
  const limit = new Date(now);
  limit.setUTCMonth(limit.getUTCMonth() - months);
  return d >= limit;
}
