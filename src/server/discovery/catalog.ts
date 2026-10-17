// Catálogos estáticos generados con scripts/build-catalogs.mts desde datos.gov.co.
import camarasData from "./data/camaras.json";
import ciiuData from "./data/ciiu.json";

export interface CiiuEntry {
  code: string;
  label: string | null;
  activeCompanies: number;
}

export const CIIU: CiiuEntry[] = ciiuData.ciiu;
export const CIIU_BY_CODE = new Map(CIIU.map((c) => [c.code, c]));
/** Solo los códigos con descripción oficial se ofrecen al LLM. */
export const CIIU_DESCRIBED = CIIU.filter((c): c is CiiuEntry & { label: string } => Boolean(c.label));

export const CAMARAS: string[] = camarasData.camaras.map((c) => c.name);

export const ciiuLabel = (code: string) => CIIU_BY_CODE.get(code)?.label ?? null;
