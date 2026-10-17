import Link from "next/link";
import { connection } from "next/server";
import { t } from "@/i18n";
import { hasDatabase } from "@/server/env";
import { listLeads, listCampaignsBrief, type ProfileFilter } from "@/server/leads";
import { CampaignSwitcher } from "../_components/campaign-switcher";
import { Help } from "../_components/help";

export const metadata = { title: `${t("leads.title")} · ${t("app.name")}` };

const UUID = /^[0-9a-f-]{36}$/i;
const SIGNAL_LABEL: Record<string, string> = {
  recent_registration: t("leads.recentRegistration"),
  web_chat_or_whatsapp: t("leads.webChat"),
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ c?: string; perfil?: string; q?: string }> }) {
  await connection();
  if (!hasDatabase()) return <p className="p-10 text-center">{t("bridge.noDatabase")}</p>;
  const sp = await searchParams;
  const profile: ProfileFilter = sp.perfil === "si" || sp.perfil === "no" ? sp.perfil : "todos";
  const [data, campaigns] = await Promise.all([listLeads({ campaignId: sp.c && UUID.test(sp.c) ? sp.c : undefined, profile, q: sp.q }), listCampaignsBrief()]);
  if (!data) return <p className="p-10 text-center">{t("leads.noCampaign")}</p>;

  const href = (perfil: ProfileFilter) => `/leads?c=${data.campaign.id}${perfil === "todos" ? "" : `&perfil=${perfil}`}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;
  const tabs: { key: ProfileFilter; label: string }[] = [
    { key: "todos", label: `${t("leads.filterAll")} (${data.counts.todos})` },
    { key: "si", label: `${t("leads.filterIn")} (${data.counts.si})` },
    { key: "no", label: `${t("leads.filterOut")} (${data.counts.no})` },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted">
            <Link href={`/?c=${data.campaign.id}`} className="underline">
              {data.campaign.name}
            </Link>
          </p>
          <h1 className="text-2xl font-bold">{t("leads.title")}</h1>
        </div>
        {campaigns.length > 1 && <CampaignSwitcher campaigns={campaigns} current={data.campaign.id} basePath="/leads" />}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("leads.title")} className="flex flex-wrap gap-2 text-sm">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={href(tab.key)}
              aria-current={profile === tab.key ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${profile === tab.key ? "border-ink bg-ink text-chrome-ink" : "border-line bg-surface"}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <form action="/leads" className="flex gap-2">
          <input type="hidden" name="c" value={data.campaign.id} />
          {profile !== "todos" && <input type="hidden" name="perfil" value={profile} />}
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder={t("leads.search")}
            aria-label={t("leads.search")}
            className="w-64 rounded-[var(--radius)] border border-line bg-surface px-3 py-1.5 text-sm"
          />
          <button className="rounded-[var(--radius)] bg-ink px-3 py-1.5 text-sm font-semibold text-chrome-ink">{t("leads.searchButton")}</button>
        </form>
      </div>

      <p className="text-sm text-muted num">
        {t("leads.summary", { total: data.rows.length, email: data.summary.withEmail, phone: data.summary.withPhone, signals: data.summary.withSignals })}
      </p>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-line bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">{t("leads.colCompany")}</th>
              <th className="px-4 py-3 font-medium">{t("leads.colActivity")}</th>
              <th className="px-4 py-3 font-medium">{t("leads.colContact")}</th>
              <th className="px-4 py-3 font-medium">{t("leads.colSource")}</th>
              <th className="px-4 py-3 font-medium">
                <span className="flex items-center gap-1">
                  {t("leads.colFit")} <Help text={t("help.fit")} />
                </span>
              </th>
              <th className="px-4 py-3 font-medium">{t("leads.colProfile")}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((l) => (
              <tr key={l.id} className="relative border-b border-line align-top last:border-0 hover:bg-bg">
                <td className="px-4 py-3">
                  <Link href={`/leads/${l.id}`} className="font-semibold underline-offset-2 after:absolute after:inset-0 hover:underline">
                    {l.name}
                  </Link>
                  {l.nit && <p className="text-xs text-muted num">NIT {l.nit}</p>}
                  {l.signals.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {l.signals.map((s) => (
                        <span key={s} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium">
                          {SIGNAL_LABEL[s] ?? s}
                        </span>
                      ))}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="num font-semibold">{l.ciiu ?? "—"}</span> <span className="text-muted">{l.ciiuLabel ?? ""}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {l.email && <p>{l.email}</p>}
                  {l.phoneE164 && <p className="num">{l.phoneE164}</p>}
                  {!l.email && !l.phoneE164 && <p className="text-muted">{t("leads.noContact")}</p>}
                </td>
                <td className="px-4 py-3 text-xs">{l.foundBy.map((s) => t(`source.${s}`)).join(" + ")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-bg" aria-hidden>
                      <div className="h-1.5 rounded-full bg-ink" style={{ width: `${l.fitScore ?? 0}%` }} />
                    </div>
                    <span className="text-xs font-semibold num">{l.fitScore ?? "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <p className={`font-semibold ${l.inProfile ? "text-done" : "text-off"}`}>
                    <span aria-hidden>{l.inProfile ? "✓ " : "— "}</span>
                    {l.inProfile ? t("leads.inProfile") : t("leads.outProfile")}
                  </p>
                  {l.profileReason && <p className="text-muted">{l.profileReason}</p>}
                </td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {t("leads.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
