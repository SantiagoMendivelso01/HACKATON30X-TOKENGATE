"use server";

// TODO(auth): restringir a operadores con Supabase Auth (D43) antes de desplegar.
import { deleteCampaign, type DeleteResult } from "@/server/campaigns";

const UUID = /^[0-9a-f-]{36}$/i;

export async function deleteCampaignAction(campaignId: string, confirmation: string): Promise<DeleteResult | { ok: false; reason: "not_confirmed" }> {
  if (!UUID.test(campaignId)) return { ok: false, reason: "not_found" };
  // La confirmación se valida también en el servidor, no solo en el diálogo.
  if (confirmation.trim().toLowerCase() !== "borrar") return { ok: false, reason: "not_confirmed" };
  return deleteCampaign(campaignId);
}
