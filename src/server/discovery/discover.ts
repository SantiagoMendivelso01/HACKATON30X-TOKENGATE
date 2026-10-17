// F1 "discover": RUES (perfil: CIIU, estado, renovación) → SECOP por NIT (contacto) → [Places] →
// deduplicación → filtro de perfil → señales y hechos citados → guardar.
// Las empresas del RUES sin contacto no se guardan como lead (no son contactables), pero entran a
// la deduplicación para que un resultado de Places herede su NIT y su CIIU.
import { stripAccents } from "@/lib/normalize";
import { ciiuLabel } from "./catalog";
import type { CampaignConfig } from "@/server/lab/config";
import { dedupe, type Candidate, type MergedLead } from "./dedupe";
import {
  registeredWithinMonths,
  RUES_LICENSE,
  ruesToCandidate,
  SECOP_LICENSE,
  secopToCandidate,
  type OpenData,
  type RuesRow,
  type SecopRow,
} from "./opendata";

export const RECENT_REGISTRATION_MONTHS = 24;

export interface DiscoveredFact {
  text: string;
  source: string;
  url?: string | null;
  license?: string | null;
  field?: string | null;
}

export interface DiscoveredSignal {
  kind: "recent_registration" | "web_chat_or_whatsapp";
  evidence: string;
  source: string;
  url?: string | null;
}

export interface DiscoveredLead {
  merged: MergedLead;
  inProfile: boolean;
  profileReason: string;
  fitScore: number;
  facts: DiscoveredFact[];
  signals: DiscoveredSignal[];
  /** Registros almacenables (SECOP/RUES) con los campos permitidos. Nunca Places. */
  sourceRecords: { source: "secop" | "rues"; externalId: string; license: string; payload: Record<string, string | undefined> }[];
}

export interface DiscoveryStats {
  ruesRows: number;
  secopRows: number;
  candidates: number;
  merged: number;
  contactable: number;
  inProfile: number;
  alreadyKnown: number;
  saved: number;
  byCiiu: Record<string, { rues: number; contactable: number; inProfile: number }>;
}

export interface DiscoveryStore {
  knownKeys(campaignId: string): Promise<{ nits: Set<string>; placeIds: Set<string> }>;
  save(campaignId: string, leads: DiscoveredLead[]): Promise<number>;
  /** Devuelve el id del evento para poder cerrarlo después. */
  logActivity(campaignId: string, messageKey: string, params: Record<string, unknown>, kind?: "working" | "done" | "attention"): Promise<string>;
  /** Un evento "trabajando" pasa a "completado" o "requiere atención" cuando el paso termina. */
  setActivityKind(id: string, kind: "done" | "attention"): Promise<void>;
}

const norm = (s: string) => stripAccents(s).toUpperCase();

/** Regla de perfil (ICP): persona jurídica, CIIU del perfil y, si el CIIU es amplio, nombre con palabra clave. */
export function profileMatch(name: string, ciiu: string | null, isLegalEntity: boolean, cfg: CampaignConfig): { ok: boolean; reason: string } {
  if (!isLegalEntity) return { ok: false, reason: "persona natural" };
  const n = norm(name);
  const excluded = cfg.filters.excludeKeywords.find((k) => n.includes(norm(k)));
  if (excluded) return { ok: false, reason: `excluida por "${excluded}"` };
  if (!ciiu) return { ok: false, reason: "sin CIIU" };
  if (!cfg.ciiu.includes(ciiu)) return { ok: false, reason: `CIIU ${ciiu} fuera del perfil` };
  const kws = cfg.filters.nameKeywordsByCiiu[ciiu];
  if (kws?.length) {
    const hit = kws.find((k) => n.includes(norm(k)));
    if (!hit) return { ok: false, reason: `CIIU ${ciiu} sin palabra clave en el nombre` };
    return { ok: true, reason: `CIIU ${ciiu} + "${hit}"` };
  }
  return { ok: true, reason: `CIIU ${ciiu}` };
}

export function fitScore(lead: MergedLead["persist"], inProfile: boolean, renewalYear: number | null, currentYear: number): number {
  let s = inProfile ? 50 : 10;
  if (lead.email) s += 15;
  if (lead.phoneE164) s += 15;
  if (lead.domain) s += 10;
  if (renewalYear && renewalYear >= currentYear) s += 10;
  return Math.min(100, s);
}

export async function runDiscovery(
  deps: { openData: OpenData; store: DiscoveryStore; now?: Date },
  campaignId: string,
  cfg: CampaignConfig,
): Promise<DiscoveryStats> {
  const now = deps.now ?? new Date();
  const { store } = deps;
  const startedId = await store.logActivity(campaignId, "activity.discoveryStarted", { ciiu: cfg.ciiu.join(", ") }, "working");
  try {
    return await discover(deps, campaignId, cfg, now, startedId);
  } catch (e) {
    await store.setActivityKind(startedId, "attention");
    throw e;
  }
}

async function discover(
  { openData, store }: { openData: OpenData; store: DiscoveryStore },
  campaignId: string,
  cfg: CampaignConfig,
  now: Date,
  startedId: string,
): Promise<DiscoveryStats> {
  const rues = await openData.queryRues({ ciiu: cfg.ciiu, camara: cfg.ruesCamara, minRenewalYear: cfg.filters.minRenewalYear, limit: 20_000 });
  const ruesByNit = new Map<string, RuesRow>();
  const ruesCandidates: Candidate[] = [];
  for (const r of rues) {
    const c = ruesToCandidate(r);
    if (!c) continue;
    ruesCandidates.push(c);
    if (c.nit) ruesByNit.set(c.nit, r);
  }

  const secop = await openData.querySecopByNits([...ruesByNit.keys()]);
  const secopByExt = new Map<string, SecopRow>();
  const secopCandidates: Candidate[] = [];
  for (const r of secop) {
    const c = secopToCandidate(r);
    if (!c) continue;
    secopCandidates.push(c);
    secopByExt.set(c.externalId, r);
  }

  const merged = dedupe([...ruesCandidates, ...secopCandidates]);
  const known = await store.knownKeys(campaignId);
  const currentYear = Number(now.toISOString().slice(0, 4));
  const byCiiu: DiscoveryStats["byCiiu"] = Object.fromEntries(cfg.ciiu.map((c) => [c, { rues: 0, contactable: 0, inProfile: 0 }]));
  for (const r of rues) if (r.cod_ciiu_act_econ_pri && byCiiu[r.cod_ciiu_act_econ_pri]) byCiiu[r.cod_ciiu_act_econ_pri].rues++;

  const toSave: DiscoveredLead[] = [];
  let contactable = 0;
  let alreadyKnown = 0;
  let inProfileCount = 0;

  for (const m of merged) {
    const p = m.persist;
    // Contactable = tiene un canal almacenable (SECOP) o vino de Places (contacto en vivo).
    const isContactable = Boolean(p.email || p.phoneE164 || p.placeId);
    if (!isContactable) continue;
    contactable++;
    if (p.ciiu && byCiiu[p.ciiu]) byCiiu[p.ciiu].contactable++;
    if ((p.nit && known.nits.has(p.nit)) || (p.placeId && known.placeIds.has(p.placeId))) {
      alreadyKnown++;
      continue;
    }

    const ruesRow = p.nit ? ruesByNit.get(p.nit) : undefined;
    const match = profileMatch(ruesRow?.razon_social ?? p.name, p.ciiu, p.isLegalEntity, cfg);
    if (match.ok) {
      inProfileCount++;
      if (p.ciiu && byCiiu[p.ciiu]) byCiiu[p.ciiu].inProfile++;
    }
    const renewalYear = ruesRow?.ultimo_ano_renovado ? Number(ruesRow.ultimo_ano_renovado) : null;

    const facts: DiscoveredFact[] = [];
    const signals: DiscoveredSignal[] = [];
    const sourceRecords: DiscoveredLead["sourceRecords"] = [];

    if (ruesRow) {
      facts.push({
        text: `Matrícula mercantil activa en la Cámara de Comercio de ${titleCase(ruesRow.camara_comercio ?? "")}${renewalYear ? `, renovada en ${renewalYear}` : ""}.`,
        source: "RUES (datos abiertos)",
        license: RUES_LICENSE,
        field: "estado_matricula",
      });
      if (p.ciiu) {
        facts.push({ text: `Actividad económica principal CIIU ${p.ciiu}${ciiuLabel(p.ciiu) ? ` (${ciiuLabel(p.ciiu)!.toLowerCase()})` : ""}.`, source: "RUES (datos abiertos)", license: RUES_LICENSE, field: "cod_ciiu_act_econ_pri" });
      }
      if (registeredWithinMonths(ruesRow.fecha_matricula, RECENT_REGISTRATION_MONTHS, now)) {
        const f = ruesRow.fecha_matricula!;
        signals.push({ kind: "recent_registration", evidence: `Matriculada el ${f.slice(6, 8)}/${f.slice(4, 6)}/${f.slice(0, 4)}`, source: "RUES (datos abiertos)" });
      }
      sourceRecords.push({ source: "rues", externalId: `${ruesRow.camara_comercio}:${ruesRow.matricula}`, license: RUES_LICENSE, payload: { ...ruesRow } });
    }

    for (const c of m.candidates) {
      const row = secopByExt.get(c.externalId);
      if (!row) continue;
      if (!facts.some((f) => f.field === "codigo")) facts.push({ text: "Registrada como proveedora en SECOP II.", source: "SECOP II (datos abiertos)", license: SECOP_LICENSE, field: "codigo" });
      sourceRecords.push({ source: "secop", externalId: row.codigo!, license: SECOP_LICENSE, payload: { ...row } });
    }

    toSave.push({
      merged: m,
      inProfile: match.ok,
      profileReason: match.reason,
      fitScore: fitScore(p, match.ok, renewalYear, currentYear),
      facts,
      signals,
      sourceRecords,
    });
  }

  const saved = await store.save(campaignId, toSave);
  const stats: DiscoveryStats = {
    ruesRows: rues.length,
    secopRows: secop.length,
    candidates: ruesCandidates.length + secopCandidates.length,
    merged: merged.length,
    contactable,
    inProfile: inProfileCount,
    alreadyKnown,
    saved,
    byCiiu,
  };
  await store.setActivityKind(startedId, "done");
  await store.logActivity(campaignId, "activity.discoveryFinished", { saved, inProfile: inProfileCount, rues: rues.length }, "done");
  return stats;
}

function titleCase(s: string): string {
  if (/^BOGOTA/i.test(s)) return "Bogotá";
  return s.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
}

