// D25: vista previa antes de lanzar. Conteo exacto en el RUES y estimación de contactables y del
// perfil con una muestra cruzada contra SECOP. Costo estimado con las tarifas de lista.
import { RATES } from "@/server/costs/rates";
import type { CampaignConfig } from "@/server/lab/config";
import { ciiuLabel } from "./catalog";
import { profileMatch } from "./discover";
import { ruesToCandidate, secopToCandidate, type OpenData } from "./opendata";

export const PREVIEW_SAMPLE = 200;
/** Páginas de Text Search por consulta (20 resultados cada una). */
export const PLACES_PAGES_PER_QUERY = 3;
/** Supuesto [H]: puntuación + dossier + redacción por lead del perfil, en USD de lista. */
export const LLM_USD_PER_LEAD_ESTIMATE = 0.01;

export interface CiiuPreview {
  code: string;
  label: string | null;
  ruesCompanies: number;
  sampled: number;
  contactableEstimate: number;
  inProfileEstimate: number;
}

export interface CampaignPreview {
  rows: CiiuPreview[];
  totals: { ruesCompanies: number; contactableEstimate: number; inProfileEstimate: number };
  /** Leads del perfil que hacen falta para 2 oleadas (D46) solo con datos abiertos. */
  neededForTwoWaves: number;
  enoughFromOpenData: boolean;
  cost: { placesRequests: number; placesListUsd: number; llmListUsd: number; totalListUsd: number };
}

export async function previewCampaign(openData: OpenData, cfg: CampaignConfig): Promise<CampaignPreview> {
  const rows: CiiuPreview[] = [];
  for (const code of cfg.ciiu) {
    const ruesCompanies = await openData.countRues({ ciiu: code, camara: cfg.ruesCamara, minRenewalYear: cfg.filters.minRenewalYear });
    const sample = ruesCompanies
      ? await openData.queryRues({ ciiu: [code], camara: cfg.ruesCamara, minRenewalYear: cfg.filters.minRenewalYear, limit: PREVIEW_SAMPLE })
      : [];
    const candidates = sample.map(ruesToCandidate).filter((c) => c?.nit);
    const secop = candidates.length ? await openData.querySecopByNits(candidates.map((c) => c!.nit!)) : [];
    const contactByNit = new Map<string, boolean>();
    for (const row of secop) {
      const c = secopToCandidate(row);
      if (c?.nit) contactByNit.set(c.nit, contactByNit.get(c.nit) || Boolean(c.email || c.phoneE164));
    }
    let contactable = 0;
    let inProfile = 0;
    for (const c of candidates) {
      if (!contactByNit.get(c!.nit!)) continue;
      contactable++;
      if (profileMatch(c!.name, c!.ciiu ?? null, c!.isLegalEntity, cfg).ok) inProfile++;
    }
    const n = candidates.length || 1;
    rows.push({
      code,
      label: ciiuLabel(code),
      ruesCompanies,
      sampled: candidates.length,
      contactableEstimate: Math.round((ruesCompanies * contactable) / n),
      inProfileEstimate: Math.round((ruesCompanies * inProfile) / n),
    });
  }

  const totals = {
    ruesCompanies: rows.reduce((s, r) => s + r.ruesCompanies, 0),
    contactableEstimate: rows.reduce((s, r) => s + r.contactableEstimate, 0),
    inProfileEstimate: rows.reduce((s, r) => s + r.inProfileEstimate, 0),
  };
  const placesRequests = cfg.placesQueries.length * PLACES_PAGES_PER_QUERY;
  const placesListUsd = placesRequests * RATES.places_request.listUnitCostUsd;
  const llmListUsd = totals.inProfileEstimate * LLM_USD_PER_LEAD_ESTIMATE;
  const neededForTwoWaves = cfg.waveSize * 2;
  return {
    rows,
    totals,
    neededForTwoWaves,
    enoughFromOpenData: totals.inProfileEstimate >= neededForTwoWaves,
    cost: { placesRequests, placesListUsd, llmListUsd, totalListUsd: placesListUsd + llmListUsd },
  };
}
