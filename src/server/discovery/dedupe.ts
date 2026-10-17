// Deduplicación en cascada (F1.2): NIT → teléfono E.164 → dominio → nombre normalizado + ciudad.
// Los datos de Places se usan en memoria para emparejar, pero nunca pasan a `persist`.
import { normalizeCity, normalizeName } from "@/lib/normalize";

export type Source = "open_data" | "places";

export interface Candidate {
  source: Source;
  /** SECOP `codigo`, RUES `matricula` o Places `place_id`. */
  externalId: string;
  name: string;
  nit?: string | null;
  city?: string | null;
  ciiu?: string | null;
  phoneE164?: string | null;
  domain?: string | null;
  email?: string | null;
  isLegalEntity: boolean;
}

export interface MergedLead {
  foundBy: Source[];
  candidates: Candidate[];
  /** Lo que se puede guardar en `lead`: solo de fuentes almacenables + `placeId`. */
  persist: {
    nit: string | null;
    name: string;
    normalizedName: string;
    city: string | null;
    ciiu: string | null;
    phoneE164: string | null;
    domain: string | null;
    email: string | null;
    isLegalEntity: boolean;
    placeId: string | null;
  };
  /** Clave por la que se fusionó (para la evidencia), o null si no hubo fusión. */
  matchedBy: MatchKey | null;
}

export type MatchKey = "nit" | "phone" | "domain" | "name_city";

class UnionFind {
  parent: number[];
  nits: (Set<string>)[];
  constructor(n: number, nitOf: (i: number) => string | null | undefined) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.nits = Array.from({ length: n }, (_, i) => {
      const nit = nitOf(i);
      return new Set(nit ? [nit] : []);
    });
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  /** No fusiona grupos con NIT distintos: un conmutador compartido no hace una sola empresa. */
  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    const na = this.nits[ra];
    const nb = this.nits[rb];
    if (na.size && nb.size && ![...na].some((n) => nb.has(n))) return false;
    this.parent[rb] = ra;
    for (const n of nb) na.add(n);
    return true;
  }
}

function keyOf(c: Candidate, key: MatchKey): string | null {
  switch (key) {
    case "nit":
      return c.nit ?? null;
    case "phone":
      return c.phoneE164 ?? null;
    case "domain":
      return c.domain ?? null;
    case "name_city": {
      const city = normalizeCity(c.city);
      const name = normalizeName(c.name);
      return city && name ? `${name}|${city}` : null;
    }
  }
}

const CASCADE: MatchKey[] = ["nit", "phone", "domain", "name_city"];

export function dedupe(candidates: Candidate[]): MergedLead[] {
  const uf = new UnionFind(candidates.length, (i) => candidates[i].nit);
  const matchedBy = new Map<number, MatchKey>();

  for (const key of CASCADE) {
    const firstByKey = new Map<string, number>();
    candidates.forEach((c, i) => {
      const k = keyOf(c, key);
      if (!k) return;
      const first = firstByKey.get(k);
      if (first === undefined) firstByKey.set(k, i);
      else if (uf.union(first, i)) {
        const root = uf.find(i);
        if (!matchedBy.has(root)) matchedBy.set(root, key);
      }
    });
  }

  const groups = new Map<number, number[]>();
  candidates.forEach((_, i) => {
    const r = uf.find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  });

  return [...groups.entries()].map(([root, idxs]) => {
    const group = idxs.map((i) => candidates[i]);
    const storable = group.filter((c) => c.source !== "places");
    const place = group.find((c) => c.source === "places");
    const pick = <K extends keyof Candidate>(k: K) =>
      (storable.find((c) => c[k] != null && c[k] !== "")?.[k] ?? null) as NonNullable<Candidate[K]> | null;
    const name = storable[0]?.name ?? group[0].name;
    return {
      foundBy: [...new Set(group.map((c) => c.source))].sort(),
      candidates: group,
      matchedBy: idxs.length > 1 ? (matchedBy.get(root) ?? null) : null,
      persist: {
        nit: pick("nit"),
        name,
        normalizedName: normalizeName(name),
        city: pick("city") ?? (place?.city ?? null),
        ciiu: pick("ciiu"),
        phoneE164: pick("phoneE164"),
        domain: pick("domain"),
        email: pick("email"),
        // Si alguna fuente almacenable dice persona natural, manda la más estricta.
        isLegalEntity: storable.length ? storable.every((c) => c.isLegalEntity) : group.every((c) => c.isLegalEntity),
        placeId: place?.externalId ?? null,
      },
    };
  });
}
