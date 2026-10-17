import { z } from "zod";

export const SOURCES = ["open_data", "places"] as const;
export const CHANNELS = ["email_simple", "email_diagnostic", "voice_direct"] as const;
export type Source = (typeof SOURCES)[number];
export type Channel = (typeof CHANNELS)[number];
export interface ArmKey {
  source: Source;
  channel: Channel;
}
export const armId = (a: ArmKey) => `${a.source}:${a.channel}`;
export const ALL_ARMS: ArmKey[] = SOURCES.flatMap((source) => CHANNELS.map((channel) => ({ source, channel })));
export const channelKind = (c: Channel): "email" | "voice" => (c === "voice_direct" ? "voice" : "email");

/** Pesos del objetivo (D12). Fijos en el MVP (D45: laboratorio editable fuera). */
export const weightsSchema = z.object({
  conversation: z.number(),
  qualified: z.number(),
  rejection: z.number(),
});
export type Weights = z.infer<typeof weightsSchema>;
export const DEFAULT_WEIGHTS: Weights = { conversation: 1, qualified: 3, rejection: -1 };

/** Umbrales estadísticos moderados (D42) y maduración de 3 h (D46). */
export const thresholdsSchema = z.object({
  minMatureContactsForEvidence: z.number().int(),
  weakBelow: z.number(),
  strongFrom: z.number(),
  turnOffBelowPBest: z.number(),
  turnOffMinContacts: z.number().int(),
  minShareActiveArm: z.number(),
  maturationHours: z.number(),
});
export type Thresholds = z.infer<typeof thresholdsSchema>;
export const DEFAULT_THRESHOLDS: Thresholds = {
  minMatureContactsForEvidence: 10,
  weakBelow: 0.8,
  strongFrom: 0.95,
  turnOffBelowPBest: 0.05,
  turnOffMinContacts: 15,
  minShareActiveArm: 0.1,
  maturationHours: 3,
};

/** Configuración de campaña que el LLM propone y el operador edita (D25). */
export const campaignConfigSchema = z.object({
  description: z.string(),
  city: z.string(),
  ciiu: z.array(z.string().regex(/^\d{4}$/)).min(1),
  placesQueries: z.array(z.string()).min(1),
  filters: z.object({
    onlyActive: z.boolean().default(true),
    minRenewalYear: z.number().int().optional(),
    excludeKeywords: z.array(z.string()).default([]),
  }),
  waveSize: z.number().int().positive().default(90),
});
export type CampaignConfig = z.infer<typeof campaignConfigSchema>;

/** Campaña real del evento (D52): Faro como cliente, clínicas odontológicas y estéticas de Bogotá. */
export const EVENT_CAMPAIGN_CONFIG: CampaignConfig = {
  description: "Clínicas odontológicas y estéticas de Bogotá que abren los sábados y reciben muchas llamadas",
  city: "Bogotá",
  // 8622 práctica odontológica, 8621 práctica médica sin internación, 9602 tratamientos de belleza
  ciiu: ["8622", "8621", "9602"],
  placesQueries: ["clínica odontológica en Bogotá", "clínica estética en Bogotá"],
  filters: { onlyActive: true, minRenewalYear: 2025, excludeKeywords: [] },
  waveSize: 90,
};
