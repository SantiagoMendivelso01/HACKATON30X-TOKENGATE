import { parsePhoneNumberFromString } from "libphonenumber-js";

const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Dígito de verificación DIAN de un NIT (sin DV). */
export function nitCheckDigit(nit: string): number {
  const digits = nit.replace(/\D/g, "").split("").reverse();
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * NIT_WEIGHTS[i], 0);
  const mod = sum % 11;
  return mod > 1 ? 11 - mod : mod;
}

/**
 * NIT sin puntos ni DV. SECOP a veces trae el DV pegado (10 dígitos), RUES nunca.
 * Solo se quita el último dígito si coincide con el DV calculado.
 */
export function normalizeNit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const [main] = raw.split("-");
  const digits = main.replace(/\D/g, "");
  if (digits.length < 6) return null;
  if (raw.includes("-")) return digits;
  if (digits.length === 10 && /^[89]/.test(digits)) {
    const base = digits.slice(0, 9);
    if (nitCheckDigit(base) === Number(digits[9])) return base;
  }
  return digits;
}

/** Valores de relleno que publica SECOP y que equivalen a vacío. */
export function cleanText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = raw.trim();
  if (!v || /^(no provisto|no definido|n\/a|na|-)$/i.test(v)) return null;
  return v;
}

export function toE164(raw: string | null | undefined, country: "CO" = "CO"): string | null {
  const v = cleanText(raw);
  if (!v) return null;
  const parsed = parsePhoneNumberFromString(v, country);
  return parsed?.isValid() ? parsed.number : null;
}

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "hotmail.es",
  "outlook.com",
  "outlook.es",
  "yahoo.com",
  "yahoo.es",
  "live.com",
  "icloud.com",
]);

/** Dominio corporativo a partir de una URL o un email. Ignora proveedores gratuitos. */
export function extractDomain(raw: string | null | undefined): string | null {
  const v = cleanText(raw)?.toLowerCase();
  if (!v) return null;
  let host: string;
  if (v.includes("@") && !v.includes("/")) {
    host = v.split("@")[1] ?? "";
  } else {
    try {
      host = new URL(v.startsWith("http") ? v : `https://${v}`).hostname;
    } catch {
      return null;
    }
  }
  host = host.replace(/^www\./, "").trim();
  if (!host.includes(".") || FREE_EMAIL_DOMAINS.has(host)) return null;
  return host;
}

const LEGAL_SUFFIXES =
  /(?:^|\s)(s\.?\s?a\.?\s?s\.?|s\.?\s?a\.?|ltda\.?|limitada|e\.?\s?u\.?|s\.?\s?en\s?c\.?|y\s?cia\.?|&\s?cia\.?|sociedad por acciones simplificada|ips)\s*$/i;

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Nombre normalizado para el último paso de la deduplicación. */
export function normalizeName(raw: string): string {
  let s = stripAccents(raw).toLowerCase().replace(/[^\p{L}\p{N}&.\s]/gu, " ");
  for (let i = 0; i < 3; i++) s = s.replace(LEGAL_SUFFIXES, "").trim();
  return s.replace(/[.&]/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeCity(raw: string | null | undefined): string | null {
  const v = cleanText(raw);
  if (!v) return null;
  const s = stripAccents(v).toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (s.startsWith("bogota")) return "bogota";
  return s;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const v = cleanText(raw)?.toLowerCase();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}
