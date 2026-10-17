// Definiciones del embudo (ADR-002, D6, D7). Umbrales ajustables con el payload real de Dapta.

export const CONVERSATION_MIN_SECONDS = 30;
export const EARLY_HANGUP_SECONDS = 10;

export interface CallFacts {
  answered: boolean;
  voicemail: boolean;
  durationSec: number | null;
  /** El lead respondió algo (turnos del usuario en la transcripción o variables con respuesta). */
  leadResponded: boolean;
  qualified: boolean | null;
  sentiment?: string | null;
  /** El agente cortó porque el titular dijo que no pidió la llamada (D37). */
  notRequested?: boolean;
}

export type RejectionKind = "opt_out" | "spam_complaint" | "hostile_reply" | "early_hangup" | "negative_sentiment" | "not_requested";

export interface CallOutcome {
  realConversation: boolean;
  qualified: boolean;
  rejection: RejectionKind | null;
}

export function classifyCall(c: CallFacts): CallOutcome {
  const human = c.answered && !c.voicemail;
  const realConversation = human && (c.durationSec ?? 0) >= CONVERSATION_MIN_SECONDS && c.leadResponded;
  let rejection: RejectionKind | null = null;
  if (c.notRequested) rejection = "not_requested";
  else if (human && c.durationSec != null && c.durationSec < EARLY_HANGUP_SECONDS) rejection = "early_hangup";
  else if (human && c.sentiment && /negat/i.test(c.sentiment)) rejection = "negative_sentiment";
  return { realConversation, qualified: c.qualified === true, rejection };
}

export interface ReplyFacts {
  class: "human" | "auto" | "bounce";
  hostile: boolean;
  unsubscribe: boolean;
}

export function classifyReply(r: ReplyFacts): { realConversation: boolean; rejection: RejectionKind | null } {
  const rejection: RejectionKind | null = r.unsubscribe ? "opt_out" : r.hostile ? "hostile_reply" : null;
  return { realConversation: r.class === "human" && !r.unsubscribe && !r.hostile, rejection };
}
