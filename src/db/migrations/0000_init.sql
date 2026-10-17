CREATE TYPE "public"."activity_kind" AS ENUM('working', 'waiting', 'attention', 'done');--> statement-breakpoint
CREATE TYPE "public"."assignment_method" AS ENUM('random', 'thompson');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('pending', 'unconfirmed', 'sent', 'failed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'discovering', 'ready', 'running', 'paused', 'done');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('email_simple', 'email_diagnostic', 'voice_direct');--> statement-breakpoint
CREATE TYPE "public"."cost_kind" AS ENUM('places_request', 'llm_tokens', 'email_send', 'dapta_call_minutes', 'dapta_call_attempt', 'fixed_prorated', 'human_minutes');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('draft', 'verified', 'blocked', 'discarded', 'sent');--> statement-breakpoint
CREATE TYPE "public"."recommendation_source" AS ENUM('llm', 'template');--> statement-breakpoint
CREATE TYPE "public"."rejection_kind" AS ENUM('opt_out', 'spam_complaint', 'hostile_reply', 'early_hangup', 'negative_sentiment', 'not_requested');--> statement-breakpoint
CREATE TYPE "public"."reply_class" AS ENUM('human', 'auto', 'bounce');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('open_data', 'places');--> statement-breakpoint
CREATE TYPE "public"."wave_status" AS ENUM('draft', 'composing', 'review', 'approved', 'sending', 'sent', 'paused');--> statement-breakpoint
CREATE TABLE "activity_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"lead_id" uuid,
	"kind" "activity_kind" NOT NULL,
	"message_key" text NOT NULL,
	"params" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arm" (
	"campaign_id" uuid NOT NULL,
	"source" "source" NOT NULL,
	"channel" "channel" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"paused_reason" text,
	"turned_off_at" timestamp with time zone,
	CONSTRAINT "arm_campaign_id_source_channel_pk" PRIMARY KEY("campaign_id","source","channel")
);
--> statement-breakpoint
CREATE TABLE "arm_assignment" (
	"lead_id" uuid NOT NULL,
	"wave_id" uuid NOT NULL,
	"source" "source" NOT NULL,
	"channel" "channel" NOT NULL,
	"method" "assignment_method" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arm_assignment_lead_id_wave_id_pk" PRIMARY KEY("lead_id","wave_id")
);
--> statement-breakpoint
CREATE TABLE "call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid,
	"dapta_call_id" text NOT NULL,
	"to_number" text,
	"answered" boolean NOT NULL,
	"voicemail" boolean NOT NULL,
	"duration_sec" integer,
	"qualified" boolean,
	"variables" jsonb,
	"summary" text,
	"sentiment" text,
	"recording_url" text,
	"ambiguous" boolean DEFAULT false NOT NULL,
	"ambiguous_reason" text,
	"raw_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_dapta_call_id_unique" UNIQUE("dapta_call_id")
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"budget_cap_usd" numeric(14, 6) NOT NULL,
	"fx_cop_per_usd" numeric(10, 2) NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"weights" jsonb NOT NULL,
	"thresholds" jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand_name" text NOT NULL,
	"brand_color" text DEFAULT '#5B3DF5' NOT NULL,
	"offer" text NOT NULL,
	"icp_text" text NOT NULL,
	"ad_cpl_cop" numeric(14, 2),
	"ad_cpl_is_external_reference" boolean DEFAULT false NOT NULL,
	"contact_language" text DEFAULT 'es-CO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"token" text NOT NULL,
	"phone_e164" text NOT NULL,
	"ip" text NOT NULL,
	"text_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"wave_id" uuid,
	"message_id" uuid,
	"channel" text NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" "attempt_status" DEFAULT 'pending' NOT NULL,
	"blocked_reason" text,
	"requested_by_holder" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"lead_id" uuid,
	"source" "source",
	"channel" "channel",
	"kind" "cost_kind" NOT NULL,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"list_unit_cost_usd" numeric(14, 6) NOT NULL,
	"list_amount_usd" numeric(14, 6) NOT NULL,
	"actual_amount_usd" numeric(14, 6) NOT NULL,
	"fx_cop_per_usd" numeric(10, 2) NOT NULL,
	"is_fixed" boolean DEFAULT false NOT NULL,
	"estimated" boolean DEFAULT false NOT NULL,
	"evidence" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dapta_webhook_raw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"headers" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "diagnostic_token" (
	"token" text PRIMARY KEY NOT NULL,
	"lead_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"calls_today" integer DEFAULT 0 NOT NULL,
	"calls_day" text
);
--> statement-breakpoint
CREATE TABLE "dossier" (
	"lead_id" uuid PRIMARY KEY NOT NULL,
	"line_who" text NOT NULL,
	"line_why" text NOT NULL,
	"line_opener" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exclusion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text,
	"email" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"url" text,
	"license" text,
	"field" text
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"nit" text,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"city" text,
	"ciiu" text,
	"domain" text,
	"phone_e164" text,
	"email" text,
	"is_legal_entity" boolean NOT NULL,
	"fit_score" integer,
	"in_profile" boolean DEFAULT false NOT NULL,
	"assigned_source" "source",
	"found_by" "source"[] NOT NULL,
	"place_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd" numeric(14, 6) NOT NULL,
	"latency_ms" integer NOT NULL,
	"valid" boolean NOT NULL,
	"output" jsonb,
	"lead_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"wave_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"claims" jsonb NOT NULL,
	"verification" jsonb,
	"status" "message_status" DEFAULT 'draft' NOT NULL,
	"blocked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome" (
	"lead_id" uuid PRIMARY KEY NOT NULL,
	"contacted_at" timestamp with time zone,
	"real_conversation_at" timestamp with time zone,
	"qualified_at" timestamp with time zone,
	"rejection_kind" "rejection_kind",
	"rejection_evidence" text,
	"rejected_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recommendation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"wave_id" uuid,
	"text_es" text NOT NULL,
	"text_en" text,
	"source" "recommendation_source" NOT NULL,
	"metrics" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reply" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid,
	"received_at" timestamp with time zone NOT NULL,
	"from" text NOT NULL,
	"body" text NOT NULL,
	"class" "reply_class" NOT NULL,
	"hostile" boolean DEFAULT false NOT NULL,
	"hostile_evidence" text,
	"unsubscribe" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"evidence" text NOT NULL,
	"source" text NOT NULL,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "source_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"license" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wave" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"n" integer NOT NULL,
	"status" "wave_status" DEFAULT 'draft' NOT NULL,
	"review_opened_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"human_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arm" ADD CONSTRAINT "arm_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arm_assignment" ADD CONSTRAINT "arm_assignment_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arm_assignment" ADD CONSTRAINT "arm_assignment_wave_id_wave_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."wave"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call" ADD CONSTRAINT "call_attempt_id_contact_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."contact_attempt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent" ADD CONSTRAINT "consent_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_attempt" ADD CONSTRAINT "contact_attempt_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_attempt" ADD CONSTRAINT "contact_attempt_wave_id_wave_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."wave"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_attempt" ADD CONSTRAINT "contact_attempt_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_event" ADD CONSTRAINT "cost_event_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_event" ADD CONSTRAINT "cost_event_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_token" ADD CONSTRAINT "diagnostic_token_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier" ADD CONSTRAINT "dossier_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_call" ADD CONSTRAINT "llm_call_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_wave_id_wave_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."wave"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome" ADD CONSTRAINT "outcome_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_wave_id_wave_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."wave"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_attempt_id_contact_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."contact_attempt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_record" ADD CONSTRAINT "source_record_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wave" ADD CONSTRAINT "wave_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_campaign_created" ON "activity_event" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "attempt_lead" ON "contact_attempt" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "cost_campaign" ON "cost_event" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "lead_campaign" ON "lead" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "lead_nit" ON "lead" USING btree ("campaign_id","nit");--> statement-breakpoint
CREATE INDEX "lead_phone" ON "lead" USING btree ("phone_e164");--> statement-breakpoint
CREATE UNIQUE INDEX "wave_campaign_n" ON "wave" USING btree ("campaign_id","n");