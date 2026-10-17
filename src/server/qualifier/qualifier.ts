// Contrato del Calificador (ADR-006). Ningún otro módulo conoce URLs, payloads ni nombres de Dapta.

export interface CallVars {
  faro_attempt_id: string;
  brand: string;
  offer: string;
  /** Las 3 líneas del dossier. */
  dossier_summary: string;
  /** D37: "requested" → confirmar que pidió la llamada; "direct" → identificarse y ofrecer la baja. */
  opening_check: "requested" | "direct";
  language: string;
}

export interface CallRequest {
  attemptId: string;
  phoneE164: string;
  vars: CallVars;
}

export interface QualifierResult {
  callId: string;
  attemptId: string | null;
  toNumber: string | null;
  answered: boolean;
  voicemail: boolean;
  durationSec: number | null;
  qualified: boolean | null;
  leadResponded: boolean;
  notRequested: boolean;
  variables: Record<string, unknown>;
  summary: string | null;
  sentiment: string | null;
  recordingUrl: string | null;
  startedAt: Date | null;
  raw: unknown;
}

export type ParseOutcome = QualifierResult | { ambiguous: true; reason: string; raw: unknown };

export interface Qualifier {
  callNow(input: CallRequest): Promise<{ accepted: boolean; raw: unknown }>;
  enqueue(input: CallRequest): Promise<{ accepted: boolean; raw: unknown }>;
  parseResult(raw: unknown): ParseOutcome;
  /** Conciliación por MCP: fuera del MVP (D45). */
  reconcile?(since: Date): Promise<QualifierResult[]>;
}
