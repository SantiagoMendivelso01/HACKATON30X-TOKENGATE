// Adaptador Places (Google Places API New, Text Search). Términos de Google: solo se guarda
// `place_id`. Teléfono, web y nombre se leen al vuelo para deduplicar y contactar, nunca se persisten.
import { extractDomain, toE164 } from "@/lib/normalize";
import type { Candidate } from "./dedupe";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places";
// Teléfono y web son SKU Enterprise (1.000 llamadas/mes gratis).
const FIELDS = ["id", "displayName", "nationalPhoneNumber", "internationalPhoneNumber", "websiteUri", "businessStatus"];

export interface LivePlace {
  placeId: string;
  name: string;
  phoneE164: string | null;
  domain: string | null;
  website: string | null;
  operational: boolean;
}

export interface Places {
  /** Una página de Text Search = 1 request facturable. */
  textSearch(query: string, pageToken?: string): Promise<{ places: LivePlace[]; nextPageToken: string | null }>;
  /** Lectura en vivo para el dossier o el contacto. */
  details(placeId: string): Promise<LivePlace | null>;
}

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
}

function toLive(p: RawPlace): LivePlace {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "",
    phoneE164: toE164(p.internationalPhoneNumber ?? p.nationalPhoneNumber),
    domain: extractDomain(p.websiteUri),
    website: p.websiteUri ?? null,
    operational: (p.businessStatus ?? "OPERATIONAL") === "OPERATIONAL",
  };
}

export class GooglePlaces implements Places {
  constructor(private apiKey: string) {}

  async textSearch(query: string, pageToken?: string) {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": [...FIELDS.map((f) => `places.${f}`), "nextPageToken"].join(","),
      },
      body: JSON.stringify({ textQuery: query, languageCode: "es", regionCode: "CO", pageSize: 20, pageToken }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Places ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { places?: RawPlace[]; nextPageToken?: string };
    return { places: (json.places ?? []).map(toLive), nextPageToken: json.nextPageToken ?? null };
  }

  async details(placeId: string) {
    const res = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}?languageCode=es`, {
      headers: { "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": FIELDS.join(",") },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return toLive((await res.json()) as RawPlace);
  }
}

/**
 * Candidato en memoria para la deduplicación. La ciudad es la de NUESTRA consulta (no un dato de
 * Places); teléfono y dominio solo viven en memoria: `dedupe` no los pasa a `persist`.
 */
export function placeToCandidate(p: LivePlace, queryCity: string): Candidate {
  return {
    source: "places",
    externalId: p.placeId,
    name: p.name,
    city: queryCity,
    phoneE164: p.phoneE164,
    domain: p.domain,
    // Places no distingue persona natural; el filtro de cumplimiento lo revisa con RUES si hay NIT.
    isLegalEntity: true,
  };
}
