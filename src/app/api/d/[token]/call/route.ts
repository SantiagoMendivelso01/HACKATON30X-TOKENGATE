import { z } from "zod";
import { env, hasDatabase } from "@/server/env";
import { requestCallNow } from "@/server/qualifier/call-now";
import { DrizzleCallNowStore } from "@/server/qualifier/call-now-store";
import { DaptaQualifier } from "@/server/qualifier/dapta";

const bodySchema = z.object({ phone: z.string().max(40), consent: z.boolean() });

const STATUS: Record<string, number> = {
  invalid_token: 404,
  expired: 410,
  no_consent: 400,
  invalid_phone: 400,
  token_daily_limit: 429,
  ip_limit: 429,
  phone_limit: 429,
  excluded: 403,
  compliance: 403,
  provider_rejected: 502,
  provider_unreachable: 504,
};

// F3: "Llámenme ahora" desde el diagnóstico público. Todo el efecto externo ocurre aquí, en el servidor.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!hasDatabase()) return Response.json({ ok: false, reason: "provider_rejected" }, { status: 503 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_phone" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const e = env();
  const result = await requestCallNow(
    {
      store: new DrizzleCallNowStore(),
      qualifier: new DaptaQualifier({ callNow: e.DAPTA_FLOW_A_CALL_NOW_URL ?? "", enqueue: e.DAPTA_FLOW_B_ENQUEUE_URL ?? "" }),
    },
    { token, phone: parsed.data.phone, consent: parsed.data.consent, ip },
  );
  // Al público solo le llega el motivo, nunca los ids internos ni el detalle de cumplimiento.
  return result.ok
    ? Response.json({ ok: true })
    : Response.json({ ok: false, reason: result.reason }, { status: STATUS[result.reason] ?? 400 });
}
