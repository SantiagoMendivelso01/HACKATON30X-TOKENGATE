"use client";

import { useState } from "react";
import { t, type MessageKey } from "@/i18n";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "waiting" } | { kind: "error"; reason: string };

export function CallNowForm({ token, brand }: { token: string; brand: string }) {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return setState({ kind: "error", reason: "no_consent" });
    setState({ kind: "sending" });
    try {
      const res = await fetch(`/api/d/${encodeURIComponent(token)}/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, consent }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      setState(json.ok ? { kind: "waiting" } : { kind: "error", reason: json.reason ?? "unknown" });
    } catch {
      setState({ kind: "error", reason: "unknown" });
    }
  }

  const errorKey = (r: string) => (`callNowError.${r}` as MessageKey);
  const disabled = state.kind === "sending" || state.kind === "waiting";

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="phone" className="block font-medium">
          {t("diagnostic.phoneLabel")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("diagnostic.phonePlaceholder")}
          disabled={disabled}
          className="w-full min-h-12 rounded-[var(--radius)] border border-line bg-surface px-3 text-lg num"
        />
      </div>

      <label className="flex gap-3 items-start text-sm leading-snug">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
        />
        <span>
          {t("diagnostic.consentText", { brand })}{" "}
          <a href="/privacidad" className="underline">
            {t("diagnostic.privacyLink")}
          </a>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={disabled}
        className="w-full min-h-12 rounded-[var(--radius)] bg-brand text-brand-ink text-lg font-semibold disabled:opacity-60"
      >
        {state.kind === "sending" ? t("diagnostic.sending") : t("diagnostic.callButton")}
      </button>

      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {state.kind === "waiting" && <span className="text-done">✓ {t("diagnostic.waiting")}</span>}
        {state.kind === "error" && <span className="text-attention">! {t(errorKey(state.reason))}</span>}
      </p>
    </form>
  );
}
