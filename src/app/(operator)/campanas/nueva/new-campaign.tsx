"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { t } from "@/i18n";
import type { CampaignPreview } from "@/server/discovery/preview";
import type { ProposeResult } from "@/server/discovery/propose";
import type { CampaignConfig } from "@/server/lab/config";
import { createAndDiscoverAction, previewAction, proposeAction } from "./actions";

type CiiuOption = { code: string; label: string };

const emptyConfig = (description: string): CampaignConfig => ({
  description,
  city: "",
  ciiu: [],
  placesQueries: [],
  ruesCamara: "BOGOTA",
  filters: { onlyActive: true, minRenewalYear: undefined, excludeKeywords: ["LIQUIDACION"], nameKeywordsByCiiu: {} },
  waveSize: 90,
});

const usd = (n: number) => `US$${n.toFixed(2)}`;
const splitComma = (s: string) => s.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
const inputCls = "w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2";
const btnPrimary = "rounded-[var(--radius)] bg-brand px-4 py-2.5 font-semibold text-brand-ink disabled:opacity-50";
const btnDark = "rounded-[var(--radius)] bg-ink px-4 py-2.5 font-semibold text-chrome-ink disabled:opacity-50";

export function NewCampaign({ ciiuOptions, camaras }: { ciiuOptions: CiiuOption[]; camaras: string[] }) {
  const router = useRouter();
  const labelOf = (code: string) => ciiuOptions.find((o) => o.code === code)?.label ?? null;

  const [description, setDescription] = useState("");
  const [proposal, setProposal] = useState<ProposeResult | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [config, setConfig] = useState<CampaignConfig | null>(null);
  const [addCode, setAddCode] = useState("");
  const [budget, setBudget] = useState(30);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"propose" | "preview" | "create" | null>(null);
  const [, startTransition] = useTransition();

  const update = (fn: (c: CampaignConfig) => CampaignConfig) => {
    setConfig((c) => (c ? fn(c) : c));
    setPreview(null);
  };

  function propose() {
    setBusy("propose");
    setError(null);
    startTransition(async () => {
      const r = await proposeAction(description);
      setBusy(null);
      if (r.ok && r.result.config) {
        setProposal(r.result);
        setLlmError(null);
        setConfig(r.result.config);
        setName(r.result.summary ?? "");
      } else {
        setProposal(r.ok ? r.result : null);
        setLlmError(r.ok ? t("newCampaign.invalidConfig") : r.reason);
        setConfig((c) => c ?? emptyConfig(description));
      }
      setPreview(null);
    });
  }

  function runPreview() {
    if (!config?.ciiu.length) return setError(t("newCampaign.invalidConfig"));
    setBusy("preview");
    setError(null);
    startTransition(async () => {
      const r = await previewAction(config);
      setBusy(null);
      if (r.ok) setPreview(r.preview);
      else setError(t("newCampaign.error", { message: r.reason }));
    });
  }

  function create() {
    if (!config?.ciiu.length) return setError(t("newCampaign.invalidConfig"));
    setBusy("create");
    setError(null);
    startTransition(async () => {
      const p = proposal?.llm;
      const r = await createAndDiscoverAction({
        name,
        config,
        budgetCapUsd: budget,
        proposal: p ? { model: p.model, inputTokens: p.inputTokens, outputTokens: p.outputTokens, latencyMs: p.latencyMs, valid: p.valid } : null,
      });
      setBusy(null);
      if (r.ok) router.push(`/?c=${r.campaignId}`);
      else setError(t("newCampaign.error", { message: r.reason }));
    });
  }

  function addCiiu() {
    const code = addCode.trim().slice(0, 4);
    if (!/^\d{4}$/.test(code)) return;
    update((c) => (c.ciiu.includes(code) ? c : { ...c, ciiu: [...c.ciiu, code] }));
    setAddCode("");
  }

  return (
    <div className="space-y-6">
      {/* 1. Describir */}
      <section className="space-y-3 rounded-[var(--radius)] border border-line bg-surface p-5">
        <h2 className="text-lg font-bold">{t("newCampaign.step1")}</h2>
        <label htmlFor="desc" className="block text-sm font-medium">
          {t("newCampaign.descriptionLabel")}
        </label>
        <textarea
          id="desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("newCampaign.descriptionPlaceholder")}
          className={inputCls}
        />
        <button type="button" onClick={propose} disabled={busy !== null || description.trim().length < 10} className={btnPrimary}>
          {busy === "propose" ? t("newCampaign.proposing") : t("newCampaign.propose")}
        </button>
        <div role="status" aria-live="polite" className="space-y-1 text-sm">
          {llmError && <p className="text-attention">! {t("newCampaign.llmUnavailable", { reason: llmError })}</p>}
          {proposal?.summary && (
            <p>
              <span className="font-semibold">{t("newCampaign.understood")}:</span> {proposal.summary}
            </p>
          )}
          {proposal && proposal.dropped.length > 0 && <p className="text-waiting">{t("newCampaign.dropped", { items: proposal.dropped.join(", ") })}</p>}
        </div>
      </section>

      {config && (
        <>
          {/* 2. Ajustar */}
          <section className="space-y-5 rounded-[var(--radius)] border border-line bg-surface p-5">
            <h2 className="text-lg font-bold">{t("newCampaign.step2")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("newCampaign.city")}</span>
                <input className={inputCls} value={config.city} onChange={(e) => update((c) => ({ ...c, city: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("newCampaign.camara")}</span>
                <select className={inputCls} value={config.ruesCamara} onChange={(e) => update((c) => ({ ...c, ruesCamara: e.target.value }))}>
                  {camaras.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("newCampaign.ciiu")}</legend>
              <p className="text-xs text-muted">{t("newCampaign.ciiuHelp")}</p>
              <ul className="space-y-2">
                {config.ciiu.map((code) => (
                  <li key={code} className="grid gap-2 rounded-[var(--radius)] border border-line p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                    <div>
                      <p className="font-semibold num">{code}</p>
                      <p className="text-sm">{labelOf(code) ?? "—"}</p>
                      {proposal?.reasons[code] && <p className="mt-1 text-xs text-muted">{proposal.reasons[code]}</p>}
                    </div>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium">{t("newCampaign.keywords")}</span>
                      <input
                        className={inputCls}
                        defaultValue={(config.filters.nameKeywordsByCiiu[code] ?? []).join(", ")}
                        onBlur={(e) =>
                          update((c) => {
                            const kws = splitComma(e.target.value);
                            const map = { ...c.filters.nameKeywordsByCiiu };
                            if (kws.length) map[code] = kws;
                            else delete map[code];
                            return { ...c, filters: { ...c.filters, nameKeywordsByCiiu: map } };
                          })
                        }
                      />
                      <span className="block text-muted">{t("newCampaign.keywordsHelp")}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => update((c) => ({ ...c, ciiu: c.ciiu.filter((x) => x !== code) }))}
                      className="justify-self-start rounded-md border border-line px-3 py-1.5 text-sm"
                      aria-label={`${t("newCampaign.remove")} ${code}`}
                    >
                      {t("newCampaign.remove")}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  list="ciiu-options"
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value)}
                  placeholder={t("newCampaign.addCiiuPlaceholder")}
                  aria-label={t("newCampaign.addCiiu")}
                  className={inputCls}
                />
                <datalist id="ciiu-options">
                  {ciiuOptions.map((o) => (
                    <option key={o.code} value={`${o.code} ${o.label}`} />
                  ))}
                </datalist>
                <button type="button" onClick={addCiiu} className="shrink-0 rounded-[var(--radius)] border border-line px-4 py-2 font-medium">
                  {t("newCampaign.addCiiu")}
                </button>
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("newCampaign.exclude")}</span>
                <input
                  className={inputCls}
                  defaultValue={config.filters.excludeKeywords.join(", ")}
                  onBlur={(e) => update((c) => ({ ...c, filters: { ...c.filters, excludeKeywords: splitComma(e.target.value) } }))}
                />
                <span className="text-xs text-muted">{t("newCampaign.commaHelp")}</span>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("newCampaign.placesQueries")}</span>
                <textarea
                  rows={3}
                  className={inputCls}
                  defaultValue={config.placesQueries.join("\n")}
                  onBlur={(e) => update((c) => ({ ...c, placesQueries: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) }))}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("newCampaign.renewal")}</span>
                <input
                  type="number"
                  className={inputCls}
                  value={config.filters.minRenewalYear ?? ""}
                  onChange={(e) => update((c) => ({ ...c, filters: { ...c.filters, minRenewalYear: e.target.value ? Number(e.target.value) : undefined } }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">{t("newCampaign.waveSize")}</span>
                  <input type="number" min={6} className={inputCls} value={config.waveSize} onChange={(e) => update((c) => ({ ...c, waveSize: Number(e.target.value) || 90 }))} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">{t("newCampaign.budget")}</span>
                  <input type="number" min={1} className={inputCls} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
                </label>
              </div>
            </div>
          </section>

          {/* 3. Vista previa */}
          <section className="space-y-3 rounded-[var(--radius)] border border-line bg-surface p-5">
            <h2 className="text-lg font-bold">{t("newCampaign.step3")}</h2>
            <button type="button" onClick={runPreview} disabled={busy !== null} className={btnDark}>
              {busy === "preview" ? t("newCampaign.previewing") : t("newCampaign.preview")}
            </button>
            {preview && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th className="py-2 pr-3 font-medium">{t("newCampaign.colCiiu")}</th>
                        <th className="py-2 pr-3 text-right font-medium">{t("newCampaign.colRues")}</th>
                        <th className="py-2 pr-3 text-right font-medium">{t("newCampaign.colContactable")}</th>
                        <th className="py-2 text-right font-medium">{t("newCampaign.colInProfile")}</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {preview.rows.map((r) => (
                        <tr key={r.code} className="border-b border-line">
                          <td className="py-2 pr-3">
                            <span className="font-semibold">{r.code}</span> <span className="text-muted">{r.label ?? ""}</span>
                          </td>
                          <td className="py-2 pr-3 text-right">{r.ruesCompanies.toLocaleString("es-CO")}</td>
                          <td className="py-2 pr-3 text-right">≈ {r.contactableEstimate.toLocaleString("es-CO")}</td>
                          <td className="py-2 text-right font-semibold">≈ {r.inProfileEstimate.toLocaleString("es-CO")}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="py-2 pr-3">{t("newCampaign.total")}</td>
                        <td className="py-2 pr-3 text-right">{preview.totals.ruesCompanies.toLocaleString("es-CO")}</td>
                        <td className="py-2 pr-3 text-right">≈ {preview.totals.contactableEstimate.toLocaleString("es-CO")}</td>
                        <td className="py-2 text-right">≈ {preview.totals.inProfileEstimate.toLocaleString("es-CO")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className={`text-sm font-medium ${preview.enoughFromOpenData ? "text-done" : "text-attention"}`}>
                  {preview.enoughFromOpenData ? "✓ " : "! "}
                  {preview.enoughFromOpenData
                    ? t("newCampaign.enough", { wave: config.waveSize })
                    : t("newCampaign.notEnough", { needed: preview.neededForTwoWaves })}
                </p>
                <p className="text-sm num">
                  {t("newCampaign.cost", {
                    total: usd(preview.cost.totalListUsd),
                    places: usd(preview.cost.placesListUsd),
                    requests: preview.cost.placesRequests,
                    llm: usd(preview.cost.llmListUsd),
                  })}
                </p>
                <p className="text-xs text-muted">{t("newCampaign.sampleNote", { n: 200 })}</p>
              </div>
            )}
          </section>

          {/* 4. Lanzar */}
          <section className="space-y-3 rounded-[var(--radius)] border-2 border-ink bg-brand-soft p-5">
            <h2 className="text-lg font-bold">{t("newCampaign.step4")}</h2>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{t("newCampaign.name")}</span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="button" onClick={create} disabled={busy !== null || !config.ciiu.length} className={btnPrimary}>
              {busy === "create" ? t("newCampaign.creating") : t("newCampaign.create")}
            </button>
          </section>
        </>
      )}

      {error && (
        <p role="alert" className="font-medium text-attention">
          ! {error}
        </p>
      )}
    </div>
  );
}
