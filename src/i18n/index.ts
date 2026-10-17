// Traducción mínima con claves tipadas. El inglés entra como otro catálogo con la misma forma (D48).
import { es, type Messages } from "./es";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type Locale = "es";

const catalogs: Record<Locale, Messages> = { es };

export function t(key: MessageKey, params?: Record<string, string | number>, locale: Locale = "es"): string {
  const value = key.split(".").reduce<unknown>((node, k) => (node as Record<string, unknown>)?.[k], catalogs[locale]);
  if (typeof value !== "string") return key;
  return params ? value.replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? `{${p}}`)) : value;
}
