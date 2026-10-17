// Tarifas de lista (D14, S-F). Cada una con URL y fecha de consulta.
// Precio de lista "como si no hubiera free tier"; el gasto real va aparte en cada asiento.

export interface Rate {
  unit: string;
  listUnitCostUsd: number;
  url: string;
  checkedAt: string;
  note?: string;
}

export const RATES = {
  /** Places API (New) Text Search, SKU Enterprise: US$35 por 1.000 después de 1.000 gratis/mes. */
  places_request: {
    unit: "request",
    listUnitCostUsd: 35 / 1000,
    url: "https://developers.google.com/maps/billing-and-pricing/pricing",
    checkedAt: "2026-10-16",
  },
  /** Dapta: 1.000 créditos = US$1. */
  dapta_credit: {
    unit: "credit",
    listUnitCostUsd: 1 / 1000,
    url: "https://docs.dapta.ai/llms.txt",
    checkedAt: "2026-10-16",
  },
  /** Brevo: 300/día gratis. Precio de lista [NC] del plan de pago más pequeño por email. */
  email_send: {
    unit: "email",
    listUnitCostUsd: 0.0009,
    url: "https://www.brevo.com/pricing/",
    checkedAt: "2026-10-16",
    note: "Pendiente de confirmar con la página de precios de Brevo (S-F)",
  },
} satisfies Record<string, Rate>;

/** Créditos de Dapta por resultado de llamada (research §1.4). */
export const DAPTA_CREDITS = {
  answeredPerMinute: 333,
  voicemail: 75,
  noAnswer: 45,
  failed: 0,
} as const;

/** Precios de LLM por millón de tokens, USD (tarifas de la API de Anthropic, prompts < 100K tokens en Haiku). */
export const LLM_PRICES: Record<string, { inputPerMTok: number; outputPerMTok: number; url: string; checkedAt: string }> = {
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10, url: "https://docs.claude.com/en/docs/about-claude/pricing", checkedAt: "2026-10-16" },
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5, url: "https://docs.claude.com/en/docs/about-claude/pricing", checkedAt: "2026-10-16" },
};

/** Costos fijos del evento (D15). `channel` indica a qué canal se imputan; null = compartido. */
export const FIXED_COSTS = [
  { key: "dapta_plan_pro", monthlyUsd: 99, channel: null, url: "https://dapta.ai/pricing/" },
  { key: "dapta_number", monthlyUsd: 28, channel: "voice" as const, url: "https://docs.dapta.ai/llms.txt" },
  { key: "email_domain", monthlyUsd: 1, channel: "email" as const, url: "", note: "Dominio ~US$12/año" },
];

/** Referencia externa de CPL de pauta (D19): Meta, Colombia, marcada como no verificada. */
export const EXTERNAL_AD_CPL_USD = 10.78;
