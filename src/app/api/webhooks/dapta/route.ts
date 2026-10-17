import { db, schema } from "@/db";
import { env } from "@/server/env";
import { authorizeDaptaWebhook, parseDaptaWebhook } from "@/server/qualifier/dapta";
import { ingestCallResult } from "@/server/qualifier/ingest";

// Webhook post-llamada de Dapta (ADR-006): secreto + IPs, payload crudo guardado, idempotente.
export async function POST(request: Request) {
  const e = env();
  if (!authorizeDaptaWebhook(request.headers, { secret: e.DAPTA_WEBHOOK_SECRET ?? "", allowedIps: e.DAPTA_WEBHOOK_IPS })) {
    return new Response("unauthorized", { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (body == null) return new Response("bad json", { status: 400 });

  const headers = Object.fromEntries([...request.headers.entries()].filter(([k]) => k !== "x-faro-secret"));
  const [raw] = await db().insert(schema.daptaWebhookRaw).values({ headers, body }).returning({ id: schema.daptaWebhookRaw.id });

  const parsed = parseDaptaWebhook(body);
  if ("ambiguous" in parsed) {
    // Se responde 200 para que Dapta no reintente: el payload crudo queda guardado para revisión.
    return Response.json({ status: "ambiguous", reason: parsed.reason });
  }
  const status = await ingestCallResult(parsed, raw.id);
  return Response.json({ status });
}
