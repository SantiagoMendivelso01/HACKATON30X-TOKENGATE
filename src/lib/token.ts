import { randomBytes } from "node:crypto";

/** Token de diagnóstico: 128 bits aleatorios, sin datos personales (03-arquitectura §5). */
export function newDiagnosticToken(): string {
  return randomBytes(16).toString("base64url");
}

export const isWellFormedToken = (t: string) => /^[A-Za-z0-9_-]{22}$/.test(t);
