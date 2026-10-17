// Frase de recomendación (D20, D47). Primero la plantilla determinista; el LLM es opcional
// y su salida solo se acepta si `verifyNumbers` confirma cada cifra contra el cálculo.
import { CHANNELS, SOURCES, type Channel, type Source } from "./config";
import type { CampaignMetrics } from "./metrics";
import type { EvidenceLevel, ThompsonResult } from "./thompson";

const SOURCE_LABEL: Record<Source, string> = { open_data: "datos abiertos", places: "Google Places" };
const CHANNEL_LABEL: Record<Channel, string> = {
  voice_direct: "voz",
  email_diagnostic: "email+diagnóstico",
  email_simple: "email",
};
const CHANNEL_VERB: Record<Channel, string> = {
  voice_direct: "Contacta por voz",
  email_diagnostic: "Contacta por email con diagnóstico",
  email_simple: "Contacta por email simple",
};
const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  insufficient: "insuficiente",
  weak: "débil",
  moderate: "moderada",
  strong: "fuerte",
};

export function formatCop(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CO")} COP`;
}

export interface Recommendation {
  text: string;
  /** Cifras que aparecen en la frase, en el formato en que aparecen. */
  numbers: string[];
  bestSource: Source | null;
  bestChannel: Channel | null;
  channelMix: Record<Channel, number>;
}

/** Suma por canal (sobre las dos fuentes) y redondea para que los porcentajes sumen 100. */
export function channelShares(byArm: Record<string, number>): Record<Channel, number> {
  const raw = Object.fromEntries(
    CHANNELS.map((c) => [c, SOURCES.reduce((s, src) => s + (byArm[`${src}:${c}`] ?? 0), 0)]),
  ) as Record<Channel, number>;
  const total = CHANNELS.reduce((s, c) => s + raw[c], 0) || 1;
  const exact = CHANNELS.map((c) => ({ c, v: (raw[c] / total) * 100 }));
  const out = Object.fromEntries(exact.map(({ c, v }) => [c, Math.floor(v)])) as Record<Channel, number>;
  let left = 100 - CHANNELS.reduce((s, c) => s + out[c], 0);
  for (const { c } of [...exact].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left-- <= 0) break;
    out[c] += 1;
  }
  return out;
}

export function templateRecommendation(m: CampaignMetrics, t: ThompsonResult, fxCopPerUsd: number): Recommendation {
  const numbers: string[] = [];
  const parts: string[] = [];

  // Dónde buscar: menor CPL incremental con denominador; si no hay, el bruto.
  const priced = m.sources
    .map((s) => ({ s, kind: s.cplIncremental.value != null ? "incremental" : "bruto", v: s.cplIncremental.value ?? s.cplGross.value }))
    .filter((x): x is typeof x & { v: number } => x.v != null);
  const best = priced.sort((a, b) => a.v - b.v)[0];
  if (best) {
    const cop = formatCop(best.v * fxCopPerUsd);
    numbers.push(cop);
    parts.push(`Busca en ${SOURCE_LABEL[best.s.source]}: cada lead del perfil te cuesta ${cop} (${best.kind}).`);
  } else {
    parts.push("Aún no hay leads del perfil para comparar fuentes.");
  }

  // Cómo contactar: P(mejor) agregada por canal.
  const pByChannel = channelShares(t.pBest);
  const bestChannel = CHANNELS.reduce((a, b) => (pByChannel[b] > pByChannel[a] ? b : a));
  const mix = channelShares(t.mix);
  if (t.evidence !== "insufficient") {
    numbers.push(`${pByChannel[bestChannel]}%`);
    parts.push(`${CHANNEL_VERB[bestChannel]}: ${pByChannel[bestChannel]}% de probabilidad de ser el mejor canal.`);
  }
  const ordered = [...CHANNELS].filter((c) => mix[c] > 0).sort((a, b) => mix[b] - mix[a]);
  numbers.push(...ordered.map((c) => `${mix[c]}%`));
  parts.push(`Próxima oleada: ${ordered.map((c) => `${mix[c]}% ${CHANNEL_LABEL[c]}`).join(" · ")}.`);

  numbers.push(String(t.matureContactsTotal));
  parts.push(`Evidencia: ${EVIDENCE_LABEL[t.evidence]} (${t.matureContactsTotal} contactos maduros).`);

  return {
    text: parts.join(" "),
    numbers,
    bestSource: best?.s.source ?? null,
    bestChannel: t.evidence === "insufficient" ? null : bestChannel,
    channelMix: mix,
  };
}

/** Cifras de un texto, tal como aparecen ("72%", "$1.200", "38"). */
export function extractNumbers(text: string): string[] {
  return [...text.matchAll(/\$?\d[\d.,]*%?/g)].map((m) => m[0].replace(/[.,]$/, ""));
}

const canon = (s: string) => s.replace(/[$\s]|COP/g, "").replace(/\./g, "").replace(",", ".");

/** Verificador de la frase del LLM: toda cifra debe estar entre las calculadas. */
export function verifyNumbers(text: string, allowed: string[]): { ok: boolean; unknown: string[] } {
  const ok = new Set(allowed.map(canon));
  const unknown = extractNumbers(text).filter((n) => !ok.has(canon(n)));
  return { ok: unknown.length === 0, unknown };
}

