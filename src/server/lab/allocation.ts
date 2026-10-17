// Asignación de leads a brazos para una oleada (F2.1, D17).
// Fuente: sorteo entre las que encontraron al lead (se fija una vez). Canal: según la mezcla.
import { armId, CHANNELS, channelKind, type Channel, type Source } from "./config";
import type { Rng } from "./stats";

export interface AllocatableLead {
  id: string;
  foundBy: Source[];
  /** Si ya se sorteó en una oleada anterior, se respeta. */
  assignedSource: Source | null;
  hasEmail: boolean;
  hasPhone: boolean;
}

export interface Assignment {
  leadId: string;
  source: Source;
  channel: Channel;
}

export interface AllocationResult {
  assignments: Assignment[];
  /** Leads sin ningún canal elegible (sin email ni teléfono) o cuyo brazo está apagado. */
  unassigned: string[];
}

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Cuotas enteras por el método del resto mayor. */
export function quotas(total: number, shares: Record<string, number>): Record<string, number> {
  const ids = Object.keys(shares);
  const sum = ids.reduce((s, id) => s + shares[id], 0) || 1;
  const raw = ids.map((id) => ({ id, exact: (shares[id] / sum) * total }));
  const out = Object.fromEntries(raw.map((r) => [r.id, Math.floor(r.exact)]));
  let left = total - Object.values(out).reduce((s, v) => s + v, 0);
  for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (left-- <= 0) break;
    out[r.id] += 1;
  }
  return out;
}

export function sortSource(lead: AllocatableLead, rng: Rng): Source {
  if (lead.assignedSource) return lead.assignedSource;
  const options = [...new Set(lead.foundBy)].sort();
  return options[Math.floor(rng() * options.length)];
}

export function allocate(leads: AllocatableLead[], mix: Record<string, number>, rng: Rng): AllocationResult {
  const assignments: Assignment[] = [];
  const unassigned: string[] = [];
  const bySource = new Map<Source, AllocatableLead[]>();
  for (const lead of shuffle(leads, rng)) {
    const s = sortSource(lead, rng);
    bySource.set(s, [...(bySource.get(s) ?? []), lead]);
  }

  for (const [source, rowLeads] of [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const rowShares = Object.fromEntries(
      CHANNELS.map((c) => [c, mix[armId({ source, channel: c })] ?? 0]).filter(([, s]) => (s as number) > 0),
    ) as Record<Channel, number>;
    const activeChannels = Object.keys(rowShares) as Channel[];
    const target = quotas(rowLeads.length, rowShares);
    const count: Record<string, number> = Object.fromEntries(activeChannels.map((c) => [c, 0]));

    const eligible = (l: AllocatableLead) =>
      activeChannels.filter((c) => (channelKind(c) === "voice" ? l.hasPhone : l.hasEmail));
    // Primero los leads con menos opciones, para no dejar sin cupo a quien solo tiene un canal.
    const ordered = [...rowLeads].sort((a, b) => eligible(a).length - eligible(b).length);

    for (const lead of ordered) {
      const options = eligible(lead);
      if (!options.length) {
        unassigned.push(lead.id);
        continue;
      }
      const deficit = (c: Channel) => (target[c] ?? 0) - count[c];
      const best = Math.max(...options.map(deficit));
      const ties = options.filter((c) => deficit(c) === best);
      const channel = ties[Math.floor(rng() * ties.length)];
      count[channel] += 1;
      assignments.push({ leadId: lead.id, source, channel });
    }
  }
  return { assignments, unassigned };
}
