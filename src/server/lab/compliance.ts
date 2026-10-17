// Filtro de cumplimiento (ADR-003). Función pura: se ejecuta antes de CADA contacto.
// Devuelve todos los motivos de bloqueo para mostrarlos en la UI.
import { bogotaParts, isColombianHoliday } from "@/lib/colombia-time";

export type BlockReason =
  | "outside_hours"
  | "sunday_or_holiday"
  | "contacted_last_7_days"
  | "excluded"
  | "natural_person"
  | "budget_exceeded"
  | "campaign_paused"
  | "arm_paused"
  | "missing_contact_data"
  | "consent_stale";

export interface ComplianceInput {
  now: Date;
  channel: "email" | "voice";
  lead: { isLegalEntity: boolean; phoneE164: string | null; email: string | null };
  /** Último contacto confirmado o sin confirmar al lead, por cualquier canal. */
  lastContactAt: Date | null;
  excluded: boolean;
  budget: { spentUsd: number; capUsd: number; nextCostUsd: number };
  campaignPaused: boolean;
  armActive: boolean;
  /**
   * Excepción D53: el titular pidió la llamada en el momento ("Llámenme ahora").
   * Exime del horario y del intervalo de 7 días (el contacto lo inicia el titular),
   * pero no de la exclusión, el presupuesto ni las pausas.
   */
  requestedByHolder?: { consentAt: Date };
}

export type ComplianceResult = { allowed: true; exception: "requested_by_holder" | null } | { allowed: false; reasons: BlockReason[] };

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
/** Ventana en la que la autorización cuenta como "en el momento". */
export const CONSENT_FRESH_MS = 10 * 60 * 1000;

/** L–V 7:00–19:00, sábado 8:00–15:00, hora de Colombia. */
export function withinLegalHours(now: Date): boolean {
  const p = bogotaParts(now);
  const minutes = p.hour * 60 + p.minute;
  if (p.weekday === 0 || isColombianHoliday(now)) return false;
  if (p.weekday === 6) return minutes >= 8 * 60 && minutes < 15 * 60;
  return minutes >= 7 * 60 && minutes < 19 * 60;
}

export function checkCompliance(input: ComplianceInput): ComplianceResult {
  const reasons: BlockReason[] = [];
  const { now } = input;
  const holder = input.requestedByHolder;
  const holderValid = holder ? now.getTime() - holder.consentAt.getTime() <= CONSENT_FRESH_MS && holder.consentAt <= now : false;

  if (holder && !holderValid) reasons.push("consent_stale");

  if (!holderValid) {
    const p = bogotaParts(now);
    if (p.weekday === 0 || isColombianHoliday(now)) reasons.push("sunday_or_holiday");
    else if (!withinLegalHours(now)) reasons.push("outside_hours");
    if (input.lastContactAt && now.getTime() - input.lastContactAt.getTime() < SEVEN_DAYS_MS) {
      reasons.push("contacted_last_7_days");
    }
  }

  if (input.excluded) reasons.push("excluded");
  if (!input.lead.isLegalEntity) reasons.push("natural_person");
  if (input.budget.spentUsd + input.budget.nextCostUsd > input.budget.capUsd) reasons.push("budget_exceeded");
  if (input.campaignPaused) reasons.push("campaign_paused");
  if (!input.armActive && !holderValid) reasons.push("arm_paused");
  if (input.channel === "voice" ? !input.lead.phoneE164 : !input.lead.email) reasons.push("missing_contact_data");

  return reasons.length ? { allowed: false, reasons } : { allowed: true, exception: holderValid ? "requested_by_holder" : null };
}
