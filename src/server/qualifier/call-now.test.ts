import { beforeEach, describe, expect, it } from "vitest";
import { newDiagnosticToken, isWellFormedToken } from "@/lib/token";
import { CONSENT_TEXT_VERSION, requestCallNow, type CallNowStore, type DiagnosticContext } from "./call-now";
import { FakeQualifier } from "./fake";
import type { CallRequest, Qualifier } from "./qualifier";

const bog = (iso: string) => new Date(`${iso}-05:00`);
const TOKEN = newDiagnosticToken();

class MemoryStore implements CallNowStore {
  ctx: DiagnosticContext | null;
  consents: { phoneE164: string; ip: string; acceptedAt: Date; textVersion: string }[] = [];
  excluded = new Set<string>();
  attempts = new Map<string, { status: string; blockedReason?: string | null }>();
  activity: { kind: string; messageKey: string }[] = [];
  spent = 0;
  lastContact: Date | null = null;

  constructor(over: Partial<DiagnosticContext> = {}) {
    this.ctx = {
      token: TOKEN,
      leadId: "lead-1",
      expiresAt: bog("2026-10-25T00:00:00"),
      callsToday: 0,
      callsDay: null,
      lead: { isLegalEntity: true },
      campaign: { id: "camp-1", paused: false, budgetCapUsd: 50 },
      brand: "Faro",
      offer: "Diagnóstico gratuito",
      dossierSummary: "Quiénes · Por qué · Cómo abrir",
      language: "es-CO",
      ...over,
    };
  }
  async getDiagnostic(token: string) {
    return this.ctx && token === this.ctx.token ? this.ctx : null;
  }
  async countConsentsByIpSince(ip: string, since: Date) {
    return this.consents.filter((c) => c.ip === ip && c.acceptedAt >= since).length;
  }
  async countConsentsByPhoneSince(phone: string, since: Date) {
    return this.consents.filter((c) => c.phoneE164 === phone && c.acceptedAt >= since).length;
  }
  async isExcluded(phone: string) {
    return this.excluded.has(phone);
  }
  async lastContactAt() {
    return this.lastContact;
  }
  async spentUsd() {
    return this.spent;
  }
  async recordConsent(c: { phoneE164: string; ip: string; acceptedAt: Date; textVersion: string }) {
    this.consents.push(c);
  }
  async bumpTokenCalls(_t: string, day: string, n: number) {
    if (this.ctx) Object.assign(this.ctx, { callsDay: day, callsToday: n });
  }
  async createAttempt() {
    const id = `att-${this.attempts.size + 1}`;
    this.attempts.set(id, { status: "pending" });
    return id;
  }
  async setAttempt(id: string, patch: { status: string; blockedReason?: string | null }) {
    this.attempts.set(id, { ...this.attempts.get(id), ...patch });
  }
  async logActivity(e: { kind: string; messageKey: string }) {
    this.activity.push(e);
  }
}

const req = (over: Partial<{ token: string; phone: string; consent: boolean; ip: string }> = {}) => ({
  token: TOKEN,
  phone: "300 111 2233",
  consent: true,
  ip: "190.1.1.1",
  ...over,
});

describe("requestCallNow", () => {
  let store: MemoryStore;
  let qualifier: FakeQualifier;
  const now = bog("2026-10-17T10:00:00");
  beforeEach(() => {
    store = new MemoryStore();
    qualifier = new FakeQualifier();
  });

  it("token de 128 bits bien formado", () => {
    expect(isWellFormedToken(TOKEN)).toBe(true);
    expect(newDiagnosticToken()).not.toBe(TOKEN);
  });

  it("camino feliz: audita el consentimiento, llama con apertura 'requested' y queda sin confirmar", async () => {
    const r = await requestCallNow({ store, qualifier, now }, req());
    expect(r).toEqual({ ok: true, attemptId: "att-1" });
    expect(store.consents[0]).toMatchObject({ phoneE164: "+573001112233", ip: "190.1.1.1", textVersion: CONSENT_TEXT_VERSION });
    expect(qualifier.calls[0]).toMatchObject({ kind: "callNow", input: { phoneE164: "+573001112233", vars: { opening_check: "requested", faro_attempt_id: "att-1" } } });
    expect(store.attempts.get("att-1")?.status).toBe("unconfirmed");
    expect(store.activity.at(-1)).toMatchObject({ kind: "waiting" });
  });

  it("D53: funciona el domingo de la demo aunque el lead recibió un email ayer", async () => {
    store.lastContact = bog("2026-10-17T09:00:00");
    const r = await requestCallNow({ store, qualifier, now: bog("2026-10-18T10:00:00") }, req());
    expect(r.ok).toBe(true);
  });

  it("rechaza sin llamar: token inválido, vencido, sin casilla, teléfono inválido, excluido", async () => {
    expect(await requestCallNow({ store, qualifier, now }, req({ token: "nope" }))).toMatchObject({ reason: "invalid_token" });
    expect(await requestCallNow({ store, qualifier, now }, req({ token: newDiagnosticToken() }))).toMatchObject({ reason: "invalid_token" });
    expect(await requestCallNow({ store, qualifier, now }, req({ consent: false }))).toMatchObject({ reason: "no_consent" });
    expect(await requestCallNow({ store, qualifier, now }, req({ phone: "123" }))).toMatchObject({ reason: "invalid_phone" });
    store.excluded.add("+573001112233");
    expect(await requestCallNow({ store, qualifier, now }, req())).toMatchObject({ reason: "excluded" });
    const expired = new MemoryStore({ expiresAt: bog("2026-10-17T09:00:00") });
    expect(await requestCallNow({ store: expired, qualifier, now }, req())).toMatchObject({ reason: "expired" });
    expect(qualifier.calls).toHaveLength(0);
    expect(store.consents).toHaveLength(0);
  });

  it("máximo 2 llamadas al día por enlace; el contador se reinicia al día siguiente", async () => {
    await requestCallNow({ store, qualifier, now }, req({ phone: "3001112233", ip: "1.1.1.1" }));
    await requestCallNow({ store, qualifier, now }, req({ phone: "3002223344", ip: "2.2.2.2" }));
    expect(await requestCallNow({ store, qualifier, now }, req({ phone: "3003334455", ip: "3.3.3.3" }))).toMatchObject({ reason: "token_daily_limit" });
    const tomorrow = await requestCallNow({ store, qualifier, now: bog("2026-10-18T10:00:00") }, req({ phone: "3003334455", ip: "3.3.3.3" }));
    expect(tomorrow.ok).toBe(true);
  });

  it("límites por IP (3/hora) y por número (2/día) entre enlaces", async () => {
    store.consents.push(...[1, 2, 3].map(() => ({ phoneE164: "+573009998877", ip: "190.1.1.1", acceptedAt: bog("2026-10-17T09:30:00"), textVersion: "v" })));
    expect(await requestCallNow({ store, qualifier, now }, req())).toMatchObject({ reason: "ip_limit" });
    store.consents = [1, 2].map(() => ({ phoneE164: "+573001112233", ip: "9.9.9.9", acceptedAt: bog("2026-10-17T07:00:00"), textVersion: "v" }));
    expect(await requestCallNow({ store, qualifier, now }, req())).toMatchObject({ reason: "phone_limit" });
  });

  it("cumplimiento: presupuesto agotado o campaña en pausa bloquea y deja el intento bloqueado", async () => {
    store.spent = 49.9;
    const r = await requestCallNow({ store, qualifier, now }, req());
    expect(r).toMatchObject({ ok: false, reason: "compliance", complianceReasons: ["budget_exceeded"] });
    expect(store.attempts.get("att-1")).toMatchObject({ status: "blocked", blockedReason: "budget_exceeded" });
    expect(qualifier.calls).toHaveLength(0);
  });

  it("rechazo explícito del proveedor → fallido; error de red → sin confirmar y atención, sin reintento", async () => {
    const rejected = await requestCallNow({ store, qualifier: new FakeQualifier(false), now }, req());
    expect(rejected).toMatchObject({ ok: false, reason: "provider_rejected" });
    expect(store.attempts.get("att-1")?.status).toBe("failed");

    let tries = 0;
    const fake = new FakeQualifier();
    const broken: Qualifier = {
      enqueue: (i: CallRequest) => fake.enqueue(i),
      parseResult: (raw: unknown) => fake.parseResult(raw),
      callNow: async () => {
        tries++;
        throw new Error("timeout");
      },
    };
    const unknown = await requestCallNow({ store, qualifier: broken, now: bog("2026-10-17T10:05:00") }, req({ ip: "5.5.5.5", phone: "3005556677" }));
    expect(unknown).toMatchObject({ ok: false, reason: "provider_unreachable" });
    expect(store.attempts.get("att-2")?.status).toBe("unconfirmed");
    expect(store.activity.at(-1)).toMatchObject({ kind: "attention" });
    expect(tries).toBe(1);
  });
});
