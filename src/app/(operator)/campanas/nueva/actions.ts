"use server";

// Acciones de "Nueva campaña" (D25). Todo efecto externo ocurre en el servidor.
// TODO(auth): restringir a operadores con Supabase Auth (D43) antes de desplegar.
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { llmCost } from "@/server/costs/ledger";
import { runDiscovery, type DiscoveryStats } from "@/server/discovery/discover";
import { DrizzleDiscoveryStore } from "@/server/discovery/discovery-store";
import { SocrataOpenData } from "@/server/discovery/opendata";
import { previewCampaign, type CampaignPreview } from "@/server/discovery/preview";
import { proposeConfig, PROPOSE_PROMPT_VERSION, type ProposeResult } from "@/server/discovery/propose";
import { env } from "@/server/env";
import { campaignConfigSchema, DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, type CampaignConfig } from "@/server/lab/config";
import { AnthropicLlm } from "@/server/llm/llm";

function describeIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "configuración"}: ${i.message}`).join("; ");
}

export type ProposeResponse = { ok: true; result: ProposeResult } | { ok: false; reason: string };

export async function proposeAction(description: string): Promise<ProposeResponse> {
  const text = description.trim();
  if (text.length < 10) return { ok: false, reason: "la descripción es muy corta" };
  try {
    return { ok: true, result: await proposeConfig(new AnthropicLlm(), text) };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, reason: "credenciales de Anthropic inválidas o ausentes" };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, reason: "límite de uso de Anthropic, intenta en un momento" };
    if (e instanceof Anthropic.APIError) return { ok: false, reason: `error ${e.status} de la API de Anthropic` };
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: /api key|apiKey|authentication/i.test(msg) ? "falta ANTHROPIC_API_KEY" : msg };
  }
}

export type PreviewResponse = { ok: true; preview: CampaignPreview } | { ok: false; reason: string };

export async function previewAction(config: CampaignConfig): Promise<PreviewResponse> {
  const cfg = campaignConfigSchema.safeParse(config);
  if (!cfg.success) return { ok: false, reason: describeIssues(cfg.error) };
  try {
    return { ok: true, preview: await previewCampaign(new SocrataOpenData(env().SOCRATA_APP_TOKEN), cfg.data) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export interface CreateInput {
  name: string;
  config: CampaignConfig;
  budgetCapUsd: number;
  /** Uso del LLM de la propuesta, para registrarlo en el libro de costos de la campaña. */
  proposal?: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; valid: boolean } | null;
}

export type CreateResponse = { ok: true; campaignId: string; stats: DiscoveryStats } | { ok: false; reason: string };

export async function createAndDiscoverAction(input: CreateInput): Promise<CreateResponse> {
  const cfg = campaignConfigSchema.safeParse(input.config);
  if (!cfg.success) return { ok: false, reason: describeIssues(cfg.error) };
  const d = db();
  // Un solo cliente configurado en el MVP (D50).
  const [client] = await d.select().from(schema.client).orderBy(desc(schema.client.createdAt)).limit(1);
  if (!client) return { ok: false, reason: "no hay cliente configurado" };
  const fx = 3900; // TODO: TRM del día de la campaña (D18)

  const [campaign] = await d
    .insert(schema.campaign)
    .values({
      clientId: client.id,
      name: input.name.trim() || cfg.data.description.slice(0, 80),
      config: cfg.data,
      budgetCapUsd: Math.max(1, input.budgetCapUsd || 30),
      fxCopPerUsd: fx,
      status: "discovering",
      weights: DEFAULT_WEIGHTS,
      thresholds: DEFAULT_THRESHOLDS,
    })
    .returning();

  if (input.proposal) {
    const p = input.proposal;
    const entry = llmCost({ campaignId: campaign.id, fxCopPerUsd: fx }, p.model, p.inputTokens, p.outputTokens, "propose_campaign");
    await d.insert(schema.costEvent).values(entry);
    await d.insert(schema.llmCall).values({
      task: "propose_campaign",
      model: p.model,
      promptVersion: PROPOSE_PROMPT_VERSION,
      inputTokens: p.inputTokens,
      outputTokens: p.outputTokens,
      costUsd: entry.actualAmountUsd,
      latencyMs: p.latencyMs,
      valid: p.valid,
      output: cfg.data,
    });
  }

  try {
    const stats = await runDiscovery({ openData: new SocrataOpenData(env().SOCRATA_APP_TOKEN), store: new DrizzleDiscoveryStore(d) }, campaign.id, cfg.data);
    await d.update(schema.campaign).set({ status: "ready" }).where(eq(schema.campaign.id, campaign.id));
    return { ok: true, campaignId: campaign.id, stats };
  } catch (e) {
    await d.insert(schema.activityEvent).values({ campaignId: campaign.id, kind: "attention", messageKey: "activity.discoveryFailed", params: { message: String(e) } });
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
