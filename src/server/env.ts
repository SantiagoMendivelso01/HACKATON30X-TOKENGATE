// Variables de entorno del servidor, validadas al usarse (no al importar) para que el build
// y los tests funcionen sin secretos. Ver .env.example.
import { z } from "zod";

const list = z
  .string()
  .default("")
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean));

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  OPERATOR_EMAILS: list,
  ANTHROPIC_API_KEY: z.string().optional(),
  SOCRATA_APP_TOKEN: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().optional(),
  BREVO_SENDER_NAME: z.string().default("Faro"),
  BREVO_REPLY_TO: z.string().optional(),
  BREVO_WEBHOOK_SECRET: z.string().optional(),
  DAPTA_FLOW_A_CALL_NOW_URL: z.string().optional(),
  DAPTA_FLOW_B_ENQUEUE_URL: z.string().optional(),
  DAPTA_WEBHOOK_SECRET: z.string().optional(),
  DAPTA_WEBHOOK_IPS: list,
});

export type Env = z.infer<typeof schema>;
let cached: Env | null = null;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);
