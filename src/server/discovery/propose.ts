// D25: descripción libre del perfil → configuración editable (CIIU, cámara, palabras clave, consultas
// de Places). Claude Sonnet propone; el código valida contra los catálogos y descarta lo que no exista.
import { z } from "zod";
import { campaignConfigSchema, type CampaignConfig } from "@/server/lab/config";
import type { Llm, StructuredResult } from "@/server/llm/llm";
import { CAMARAS, CIIU_BY_CODE, CIIU_DESCRIBED } from "./catalog";

export const PROPOSE_PROMPT_VERSION = "propose-v1";

export const proposalSchema = z.object({
  summary: z.string().describe("Una frase en español con el perfil entendido"),
  city: z.string().describe("Ciudad o región principal, como la escribiría el operador"),
  ruesCamara: z.string().describe("Nombre EXACTO de la cámara de comercio de la lista"),
  ciiu: z
    .array(z.object({ code: z.string().describe("Código CIIU de 4 dígitos de la lista"), reason: z.string() }))
    .describe("Entre 1 y 6 códigos CIIU que describen la actividad del perfil"),
  nameKeywords: z
    .array(z.object({ code: z.string(), keywords: z.array(z.string()) }))
    .describe("Solo para CIIU amplios: palabras que debe contener la razón social para entrar al perfil"),
  excludeKeywords: z.array(z.string()).describe("Palabras de razón social que sacan a la empresa del perfil"),
  placesQueries: z.array(z.string()).describe("2 a 4 búsquedas en Google Maps en español, con la ciudad"),
  minRenewalYear: z.number().int().nullable().describe("Año mínimo de renovación de la matrícula, o null"),
});
export type Proposal = z.infer<typeof proposalSchema>;

export interface ProposeResult {
  config: CampaignConfig | null;
  summary: string | null;
  reasons: Record<string, string>;
  /** Lo que el LLM propuso y el código descartó por no existir en los catálogos. */
  dropped: string[];
  llm: Omit<StructuredResult<unknown>, "output">;
}

function systemPrompt(): string {
  const ciiu = CIIU_DESCRIBED.map((c) => `${c.code} ${c.label}`).join("\n");
  return [
    "Eres el analista de Faro. Traduces la descripción de un cliente ideal (pymes en Colombia) a filtros sobre",
    "el registro mercantil (RUES) y búsquedas en Google Maps. Usa solo códigos CIIU y cámaras de las listas.",
    "Prefiere pocos códigos precisos. Si un código es amplio (abarca mucho más que el perfil), agrega palabras",
    "clave de razón social en mayúsculas y sin tildes para quedarte solo con las empresas del perfil.",
    "Excluye entidades públicas, hospitales, EPS y empresas en liquidación cuando no sean el perfil.",
    "",
    "CÁMARAS DE COMERCIO:",
    CAMARAS.join(" | "),
    "",
    "CÓDIGOS CIIU (Rev. 4 A.C.):",
    ciiu,
  ].join("\n");
}

/** Valida contra los catálogos y arma la configuración. Función pura, testeable sin LLM. */
export function proposalToConfig(p: Proposal, description: string): { config: CampaignConfig; reasons: Record<string, string>; dropped: string[] } {
  const dropped: string[] = [];
  const codes = [...new Set(p.ciiu.map((c) => c.code.trim()))].filter((code) => {
    const ok = /^\d{4}$/.test(code) && CIIU_BY_CODE.has(code);
    if (!ok) dropped.push(`CIIU ${code}`);
    return ok;
  });
  const reasons = Object.fromEntries(p.ciiu.filter((c) => codes.includes(c.code.trim())).map((c) => [c.code.trim(), c.reason]));
  const camara = CAMARAS.find((c) => c === p.ruesCamara.trim().toUpperCase()) ?? null;
  if (!camara) dropped.push(`cámara "${p.ruesCamara}"`);

  const nameKeywordsByCiiu = Object.fromEntries(
    p.nameKeywords.filter((k) => codes.includes(k.code) && k.keywords.length).map((k) => [k.code, k.keywords.map((w) => w.trim().toUpperCase()).filter(Boolean)]),
  );

  const config = campaignConfigSchema.parse({
    description,
    city: p.city,
    ciiu: codes, // vacío → el esquema falla y el operador arma la configuración a mano
    placesQueries: p.placesQueries.length ? p.placesQueries : [description],
    ruesCamara: camara ?? "BOGOTA",
    filters: {
      onlyActive: true,
      minRenewalYear: p.minRenewalYear ?? undefined,
      excludeKeywords: p.excludeKeywords.map((w) => w.trim().toUpperCase()).filter(Boolean),
      nameKeywordsByCiiu,
    },
  });
  return { config, reasons, dropped };
}

export async function proposeConfig(llm: Llm, description: string): Promise<ProposeResult> {
  const res = await llm.structured({
    task: "propose_campaign",
    promptVersion: PROPOSE_PROMPT_VERSION,
    tier: "writer",
    system: systemPrompt(),
    user: `Descripción del cliente ideal:\n"""${description.slice(0, 2000)}"""`,
    schema: proposalSchema,
  });
  const { output, ...llmMeta } = res;
  if (!output) return { config: null, summary: null, reasons: {}, dropped: [], llm: llmMeta };
  try {
    const { config, reasons, dropped } = proposalToConfig(output, description);
    return { config, summary: output.summary, reasons, dropped, llm: llmMeta };
  } catch {
    // Sin ningún CIIU válido la configuración no cumple el esquema: el operador la arma a mano.
    return { config: null, summary: output.summary, reasons: {}, dropped: output.ciiu.map((c) => `CIIU ${c.code}`), llm: llmMeta };
  }
}
