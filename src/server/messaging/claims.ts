// Verificador de afirmaciones (D10), parte determinista. Toda afirmación del mensaje debe apuntar
// a un hecho del dossier; la parte con LLM (Haiku) comprueba además que el hecho la respalde.
import { z } from "zod";

export const claimSchema = z.object({
  /** Fragmento literal del mensaje que afirma algo sobre el lead. */
  text: z.string().min(1),
  /** Id del hecho del dossier que la respalda. */
  factId: z.string().nullable(),
});
export type Claim = z.infer<typeof claimSchema>;

export interface FactRef {
  id: string;
  text: string;
  source: string;
}

export type ClaimIssue = { claim: string; problem: "no_fact" | "unknown_fact" | "not_in_body" | "unsupported" };

export interface ClaimCheck {
  ok: boolean;
  issues: ClaimIssue[];
}

/**
 * Comprueba estructura: cada afirmación aparece en el cuerpo y cita un hecho existente.
 * `supported` (opcional) es el veredicto del LLM por afirmación.
 */
export function checkClaims(body: string, claims: Claim[], facts: FactRef[], supported?: Record<string, boolean>): ClaimCheck {
  const factIds = new Set(facts.map((f) => f.id));
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const nbody = norm(body);
  const issues: ClaimIssue[] = [];
  for (const c of claims) {
    if (!nbody.includes(norm(c.text))) issues.push({ claim: c.text, problem: "not_in_body" });
    else if (!c.factId) issues.push({ claim: c.text, problem: "no_fact" });
    else if (!factIds.has(c.factId)) issues.push({ claim: c.text, problem: "unknown_fact" });
    else if (supported && supported[c.text] === false) issues.push({ claim: c.text, problem: "unsupported" });
  }
  return { ok: issues.length === 0, issues };
}
