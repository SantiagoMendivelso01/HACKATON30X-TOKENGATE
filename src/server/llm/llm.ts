// Adaptador Llm (D40): Sonnet 5.5 redacta, Haiku 5.5 clasifica y verifica.
// Salidas estructuradas validadas con Zod. Cada llamada devuelve lo necesario para `llm_call` y el asiento de costo.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const MODELS = {
  writer: "claude-sonnet-5-5",
  classifier: "claude-haiku-5-5",
} as const;
export type ModelTier = keyof typeof MODELS;

export interface StructuredRequest<S extends z.ZodType> {
  task: string;
  promptVersion: string;
  tier: ModelTier;
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface StructuredResult<T> {
  /** null si el modelo se negó, se cortó o la salida no validó. El llamador usa su respaldo determinista. */
  output: T | null;
  valid: boolean;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  stopReason: string | null;
}

export interface Llm {
  structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>>;
}

export class AnthropicLlm implements Llm {
  constructor(private client = new Anthropic()) {}

  async structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>> {
    const model = MODELS[req.tier];
    const started = Date.now();
    const response = await this.client.messages.parse(
      {
        model,
        max_tokens: req.maxTokens ?? 4000,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        // Clasificar y verificar es trabajo corto: esfuerzo bajo. Redactar: medio.
        output_config: { format: zodOutputFormat(req.schema), effort: req.tier === "classifier" ? "low" : "medium" },
      },
      { timeout: req.timeoutMs ?? 60_000 },
    );
    const parsed = response.stop_reason === "end_turn" ? req.schema.safeParse(response.parsed_output) : null;
    return {
      output: parsed?.success ? parsed.data : null,
      valid: parsed?.success ?? false,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - started,
      stopReason: response.stop_reason,
    };
  }
}

/** Solo para tests: devuelve salidas programadas por tarea. */
export class FakeLlm implements Llm {
  calls: StructuredRequest<z.ZodType>[] = [];
  constructor(private outputs: Record<string, unknown>) {}

  async structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>> {
    this.calls.push(req);
    const parsed = req.schema.safeParse(this.outputs[req.task]);
    return {
      output: parsed.success ? parsed.data : null,
      valid: parsed.success,
      model: MODELS[req.tier],
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 1,
      stopReason: "end_turn",
    };
  }
}
