// F4: procesar un resultado de Dapta. Idempotente por `call_id`; correlación por `faro_attempt_id`,
// si falta por número + ventana de tiempo, y si no cuadra queda como ambigua (D36): nunca se adivina.
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { daptaCallCost } from "@/server/costs/ledger";
import { classifyCall } from "@/server/lab/funnel";
import type { QualifierResult } from "./qualifier";

const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;

export type IngestOutcome = "duplicate" | "ambiguous" | "processed";

export async function ingestCallResult(r: QualifierResult, rawId: string): Promise<IngestOutcome> {
  return db().transaction(async (tx) => {
    const [dup] = await tx.select({ id: schema.call.id }).from(schema.call).where(eq(schema.call.daptaCallId, r.callId));
    if (dup) return "duplicate";

    let attempt = r.attemptId
      ? (await tx.select().from(schema.contactAttempt).where(eq(schema.contactAttempt.id, r.attemptId)))[0]
      : undefined;
    let ambiguousReason: string | null = null;

    if (!attempt && r.toNumber && r.startedAt) {
      const inWindow = and(
        eq(schema.contactAttempt.provider, "dapta"),
        gte(schema.contactAttempt.createdAt, new Date(r.startedAt.getTime() - MATCH_WINDOW_MS)),
        lte(schema.contactAttempt.createdAt, r.startedAt),
      );
      // Llamada directa: el número es el del lead. "Llámenme ahora": el que dio el titular (consent).
      const byLeadPhone = await tx
        .select({ attempt: schema.contactAttempt })
        .from(schema.contactAttempt)
        .innerJoin(schema.lead, eq(schema.lead.id, schema.contactAttempt.leadId))
        .where(and(inWindow, eq(schema.lead.phoneE164, r.toNumber)))
        .orderBy(desc(schema.contactAttempt.createdAt));
      const byConsentPhone = await tx
        .selectDistinct({ attempt: schema.contactAttempt })
        .from(schema.contactAttempt)
        .innerJoin(schema.consent, eq(schema.consent.leadId, schema.contactAttempt.leadId))
        .where(and(inWindow, eq(schema.contactAttempt.requestedByHolder, true), eq(schema.consent.phoneE164, r.toNumber)));
      const candidates = [...new Map([...byLeadPhone, ...byConsentPhone].map((c) => [c.attempt.id, c])).values()];
      if (candidates.length === 1) attempt = candidates[0].attempt;
      else ambiguousReason = candidates.length ? `${candidates.length} intentos posibles para ${r.toNumber}` : "sin intento que coincida";
    } else if (!attempt) {
      ambiguousReason = r.attemptId ? `intento ${r.attemptId} inexistente` : "sin faro_attempt_id ni número";
    }

    await tx.insert(schema.call).values({
      attemptId: attempt?.id ?? null,
      daptaCallId: r.callId,
      toNumber: r.toNumber,
      answered: r.answered,
      voicemail: r.voicemail,
      durationSec: r.durationSec,
      qualified: r.qualified,
      variables: r.variables,
      summary: r.summary,
      sentiment: r.sentiment,
      recordingUrl: r.recordingUrl,
      ambiguous: !attempt,
      ambiguousReason,
      rawId,
    });
    await tx.update(schema.daptaWebhookRaw).set({ processed: true, error: ambiguousReason }).where(eq(schema.daptaWebhookRaw.id, rawId));
    if (!attempt) return "ambiguous";

    const now = new Date();
    const at = r.startedAt ?? now;
    const outcome = classifyCall(r);
    if (attempt.status !== "sent") {
      await tx.update(schema.contactAttempt).set({ status: "sent", sentAt: attempt.sentAt ?? at }).where(eq(schema.contactAttempt.id, attempt.id));
    }

    const [prev] = await tx.select().from(schema.outcome).where(eq(schema.outcome.leadId, attempt.leadId));
    const next = {
      leadId: attempt.leadId,
      contactedAt: prev?.contactedAt ?? at,
      realConversationAt: prev?.realConversationAt ?? (outcome.realConversation ? at : null),
      qualifiedAt: prev?.qualifiedAt ?? (outcome.qualified ? at : null),
      rejectionKind: prev?.rejectionKind ?? outcome.rejection,
      rejectionEvidence: prev?.rejectionEvidence ?? (outcome.rejection ? `Llamada ${r.callId}: ${outcome.rejection}` : null),
      rejectedAt: prev?.rejectedAt ?? (outcome.rejection ? at : null),
    };
    await tx.insert(schema.outcome).values(next).onConflictDoUpdate({ target: schema.outcome.leadId, set: next });

    const [lead] = await tx.select().from(schema.lead).where(eq(schema.lead.id, attempt.leadId));
    const [campaign] = await tx.select().from(schema.campaign).where(eq(schema.campaign.id, lead.campaignId));
    const [assignment] = attempt.waveId
      ? await tx
          .select()
          .from(schema.armAssignment)
          .where(and(eq(schema.armAssignment.leadId, lead.id), eq(schema.armAssignment.waveId, attempt.waveId)))
      : [];
    // La llamada "Llámenme ahora" se imputa al brazo que trajo al lead al diagnóstico.
    await tx.insert(schema.costEvent).values(
      daptaCallCost(
        {
          campaignId: campaign.id,
          fxCopPerUsd: campaign.fxCopPerUsd,
          leadId: lead.id,
          source: assignment?.source ?? lead.assignedSource,
          channel: assignment?.channel ?? null,
        },
        r,
        r.callId,
      ),
    );

    await tx.insert(schema.activityEvent).values({
      campaignId: campaign.id,
      leadId: lead.id,
      kind: "done",
      messageKey: outcome.qualified ? "activity.callQualified" : "activity.callFinished",
      params: { callId: r.callId, durationSec: r.durationSec },
    });
    return "processed";
  });
}
