// Esquema de Faro (03-arquitectura §3). Solo el módulo de esquema cambia este archivo.
// Regla de cumplimiento impuesta por el esquema (ADR-003, D41): de Google Places solo se
// guarda `place_id`. No hay columnas para teléfono, web, horario ni rating de Places.
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const usd = (name: string) => numeric(name, { precision: 14, scale: 6, mode: "number" });

export const sourceEnum = pgEnum("source", ["open_data", "places"]);
export const channelEnum = pgEnum("channel", ["email_simple", "email_diagnostic", "voice_direct"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "discovering", "ready", "running", "paused", "done"]);
export const waveStatusEnum = pgEnum("wave_status", ["draft", "composing", "review", "approved", "sending", "sent", "paused"]);
export const assignmentMethodEnum = pgEnum("assignment_method", ["random", "thompson"]);
export const messageStatusEnum = pgEnum("message_status", ["draft", "verified", "blocked", "discarded", "sent"]);
export const attemptStatusEnum = pgEnum("attempt_status", ["pending", "unconfirmed", "sent", "failed", "blocked"]);
export const replyClassEnum = pgEnum("reply_class", ["human", "auto", "bounce"]);
export const rejectionKindEnum = pgEnum("rejection_kind", ["opt_out", "spam_complaint", "hostile_reply", "early_hangup", "negative_sentiment", "not_requested"]);
export const costKindEnum = pgEnum("cost_kind", [
  "places_request",
  "llm_tokens",
  "email_send",
  "dapta_call_minutes",
  "dapta_call_attempt",
  "fixed_prorated",
  "human_minutes",
]);
export const activityKindEnum = pgEnum("activity_kind", ["working", "waiting", "attention", "done"]);
export const recommendationSourceEnum = pgEnum("recommendation_source", ["llm", "template"]);

export const client = pgTable("client", {
  id: id(),
  name: text("name").notNull(),
  brandName: text("brand_name").notNull(),
  brandColor: text("brand_color").notNull().default("#5B3DF5"),
  offer: text("offer").notNull(),
  icpText: text("icp_text").notNull(),
  adCplCop: numeric("ad_cpl_cop", { precision: 14, scale: 2, mode: "number" }),
  adCplIsExternalReference: boolean("ad_cpl_is_external_reference").notNull().default(false),
  contactLanguage: text("contact_language").notNull().default("es-CO"),
  createdAt: createdAt(),
});

export const campaign = pgTable("campaign", {
  id: id(),
  clientId: uuid("client_id").notNull().references(() => client.id),
  name: text("name").notNull(),
  /** CampaignConfig (src/server/lab/config.ts): CIIU, consultas de Places, filtros. */
  config: jsonb("config").notNull(),
  budgetCapUsd: usd("budget_cap_usd").notNull(),
  fxCopPerUsd: numeric("fx_cop_per_usd", { precision: 10, scale: 2, mode: "number" }).notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  /** Pesos del objetivo (D12): conversación=1, calificado=3, rechazo=-1. */
  weights: jsonb("weights").notNull(),
  /** Umbrales estadísticos (D42). */
  thresholds: jsonb("thresholds").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  paused: boolean("paused").notNull().default(false),
  createdAt: createdAt(),
});

export const wave = pgTable(
  "wave",
  {
    id: id(),
    campaignId: uuid("campaign_id").notNull().references(() => campaign.id),
    n: integer("n").notNull(),
    status: waveStatusEnum("status").notNull().default("draft"),
    reviewOpenedAt: timestamp("review_opened_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    humanSeconds: integer("human_seconds"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wave_campaign_n").on(t.campaignId, t.n)],
);

/** Pausa por brazo (D30). Un brazo = fuente × canal dentro de una campaña. */
export const arm = pgTable(
  "arm",
  {
    campaignId: uuid("campaign_id").notNull().references(() => campaign.id),
    source: sourceEnum("source").notNull(),
    channel: channelEnum("channel").notNull(),
    active: boolean("active").notNull().default(true),
    pausedReason: text("paused_reason"),
    turnedOffAt: timestamp("turned_off_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.source, t.channel] })],
);

export const lead = pgTable(
  "lead",
  {
    id: id(),
    campaignId: uuid("campaign_id").notNull().references(() => campaign.id),
    nit: text("nit"),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    city: text("city"),
    ciiu: text("ciiu"),
    domain: text("domain"),
    phoneE164: text("phone_e164"),
    email: text("email"),
    isLegalEntity: boolean("is_legal_entity").notNull(),
    fitScore: integer("fit_score"),
    inProfile: boolean("in_profile").notNull().default(false),
    assignedSource: sourceEnum("assigned_source"),
    foundBy: sourceEnum("found_by").array().notNull(),
    /** Único dato de Google Places que se guarda. */
    placeId: text("place_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("lead_campaign").on(t.campaignId),
    index("lead_nit").on(t.campaignId, t.nit),
    index("lead_phone").on(t.phoneE164),
  ],
);

/** Solo fuentes almacenables (SECOP, RUES, web). Nunca Places. */
export const sourceRecord = pgTable("source_record", {
  id: id(),
  leadId: uuid("lead_id").notNull().references(() => lead.id),
  source: text("source").notNull(), // 'secop' | 'rues' | 'web'
  externalId: text("external_id").notNull(),
  license: text("license").notNull(),
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fact = pgTable("fact", {
  id: id(),
  leadId: uuid("lead_id").notNull().references(() => lead.id),
  text: text("text").notNull(),
  source: text("source").notNull(),
  url: text("url"),
  license: text("license"),
  field: text("field"),
});

export const signal = pgTable("signal", {
  id: id(),
  leadId: uuid("lead_id").notNull().references(() => lead.id),
  kind: text("kind").notNull(), // 'web_chat_or_whatsapp' | 'recent_registration' (D51)
  evidence: text("evidence").notNull(),
  source: text("source").notNull(),
  url: text("url"),
});

export const dossier = pgTable("dossier", {
  leadId: uuid("lead_id").primaryKey().references(() => lead.id),
  lineWho: text("line_who").notNull(),
  lineWhy: text("line_why").notNull(),
  lineOpener: text("line_opener").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const armAssignment = pgTable(
  "arm_assignment",
  {
    leadId: uuid("lead_id").notNull().references(() => lead.id),
    waveId: uuid("wave_id").notNull().references(() => wave.id),
    source: sourceEnum("source").notNull(),
    channel: channelEnum("channel").notNull(),
    method: assignmentMethodEnum("method").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.leadId, t.waveId] })],
);

export const message = pgTable("message", {
  id: id(),
  leadId: uuid("lead_id").notNull().references(() => lead.id),
  waveId: uuid("wave_id").notNull().references(() => wave.id),
  channel: channelEnum("channel").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  claims: jsonb("claims").notNull(),
  verification: jsonb("verification"),
  status: messageStatusEnum("status").notNull().default("draft"),
  blockedReason: text("blocked_reason"),
  createdAt: createdAt(),
});

export const contactAttempt = pgTable(
  "contact_attempt",
  {
    id: id(),
    leadId: uuid("lead_id").notNull().references(() => lead.id),
    waveId: uuid("wave_id").references(() => wave.id),
    messageId: uuid("message_id").references(() => message.id),
    channel: text("channel").notNull(), // canal del brazo o 'voice_call_now'
    provider: text("provider").notNull(), // 'brevo' | 'dapta'
    providerRef: text("provider_ref"),
    status: attemptStatusEnum("status").notNull().default("pending"),
    blockedReason: text("blocked_reason"),
    /** Excepción D53: llamada solicitada por el titular en el momento. */
    requestedByHolder: boolean("requested_by_holder").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("attempt_lead").on(t.leadId)],
);

export const call = pgTable("call", {
  id: id(),
  attemptId: uuid("attempt_id").references(() => contactAttempt.id),
  daptaCallId: text("dapta_call_id").notNull().unique(),
  toNumber: text("to_number"),
  answered: boolean("answered").notNull(),
  voicemail: boolean("voicemail").notNull(),
  durationSec: integer("duration_sec"),
  qualified: boolean("qualified"),
  variables: jsonb("variables"),
  summary: text("summary"),
  sentiment: text("sentiment"),
  recordingUrl: text("recording_url"),
  ambiguous: boolean("ambiguous").notNull().default(false),
  ambiguousReason: text("ambiguous_reason"),
  rawId: uuid("raw_id"),
  createdAt: createdAt(),
});

export const reply = pgTable("reply", {
  id: id(),
  attemptId: uuid("attempt_id").references(() => contactAttempt.id),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  from: text("from").notNull(),
  body: text("body").notNull(),
  class: replyClassEnum("class").notNull(),
  hostile: boolean("hostile").notNull().default(false),
  hostileEvidence: text("hostile_evidence"),
  unsubscribe: boolean("unsubscribe").notNull().default(false),
});

export const outcome = pgTable("outcome", {
  leadId: uuid("lead_id").primaryKey().references(() => lead.id),
  contactedAt: timestamp("contacted_at", { withTimezone: true }),
  realConversationAt: timestamp("real_conversation_at", { withTimezone: true }),
  qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
  rejectionKind: rejectionKindEnum("rejection_kind"),
  rejectionEvidence: text("rejection_evidence"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
});

export const consent = pgTable("consent", {
  id: id(),
  leadId: uuid("lead_id").notNull().references(() => lead.id),
  token: text("token").notNull(),
  phoneE164: text("phone_e164").notNull(),
  ip: text("ip").notNull(),
  textVersion: text("text_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const exclusion = pgTable("exclusion", {
  id: id(),
  phoneE164: text("phone_e164"),
  email: text("email"),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

export const diagnosticToken = pgTable("diagnostic_token", {
  token: text("token").primaryKey(),
  leadId: uuid("lead_id").notNull().references(() => lead.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  callsToday: integer("calls_today").notNull().default(0),
  callsDay: text("calls_day"), // YYYY-MM-DD en hora de Colombia
});

/** Libro de costos (ADR-002). */
export const costEvent = pgTable(
  "cost_event",
  {
    id: id(),
    campaignId: uuid("campaign_id").notNull().references(() => campaign.id),
    leadId: uuid("lead_id").references(() => lead.id),
    source: sourceEnum("source"),
    channel: channelEnum("channel"),
    kind: costKindEnum("kind").notNull(),
    quantity: real("quantity").notNull(),
    unit: text("unit").notNull(),
    listUnitCostUsd: usd("list_unit_cost_usd").notNull(),
    listAmountUsd: usd("list_amount_usd").notNull(),
    actualAmountUsd: usd("actual_amount_usd").notNull(),
    fxCopPerUsd: numeric("fx_cop_per_usd", { precision: 10, scale: 2, mode: "number" }).notNull(),
    isFixed: boolean("is_fixed").notNull().default(false),
    estimated: boolean("estimated").notNull().default(false),
    evidence: text("evidence").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("cost_campaign").on(t.campaignId)],
);

export const llmCall = pgTable("llm_call", {
  id: id(),
  task: text("task").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: usd("cost_usd").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  valid: boolean("valid").notNull(),
  output: jsonb("output"),
  leadId: uuid("lead_id").references(() => lead.id),
  createdAt: createdAt(),
});

export const activityEvent = pgTable(
  "activity_event",
  {
    id: id(),
    campaignId: uuid("campaign_id").notNull().references(() => campaign.id),
    leadId: uuid("lead_id").references(() => lead.id),
    kind: activityKindEnum("kind").notNull(),
    messageKey: text("message_key").notNull(),
    params: jsonb("params"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_campaign_created").on(t.campaignId, t.createdAt)],
);

export const recommendation = pgTable("recommendation", {
  id: id(),
  campaignId: uuid("campaign_id").notNull().references(() => campaign.id),
  waveId: uuid("wave_id").references(() => wave.id),
  textEs: text("text_es").notNull(),
  textEn: text("text_en"),
  source: recommendationSourceEnum("source").notNull(),
  metrics: jsonb("metrics").notNull(),
  createdAt: createdAt(),
});

export const daptaWebhookRaw = pgTable("dapta_webhook_raw", {
  id: id(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  headers: jsonb("headers").notNull(),
  body: jsonb("body").notNull(),
  processed: boolean("processed").notNull().default(false),
  error: text("error"),
});
