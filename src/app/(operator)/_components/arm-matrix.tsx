import { t } from "@/i18n";
import { CHANNELS, SOURCES, armId } from "@/server/lab/config";
import type { CampaignMetrics } from "@/server/lab/metrics";
import { formatCop } from "@/server/lab/recommendation";
import type { ThompsonResult } from "@/server/lab/thompson";

const STATUS = {
  active: { icon: "●", cls: "text-done" },
  insufficient: { icon: "◌", cls: "text-waiting" },
  off: { icon: "■", cls: "text-off" },
} as const;

export function ArmMatrix({ metrics, thompson, fx, minContacts }: { metrics: CampaignMetrics; thompson: ThompsonResult; fx: number; minContacts: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-2 text-sm">
        <thead>
          <tr>
            <th className="w-36" />
            {CHANNELS.map((c) => (
              <th key={c} scope="col" className="px-1 text-left font-display text-sm font-semibold">
                {t(`channel.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SOURCES.map((s) => (
            <tr key={s} className="align-top">
              <th scope="row" className="pt-3 pr-2 text-left">
                <span className="block text-xs text-muted">{t("bridge.sourceLabel")}</span>
                <span className="font-display font-semibold">{t(`source.${s}`)}</span>
              </th>
              {CHANNELS.map((c) => {
                const id = armId({ source: s, channel: c });
                const m = metrics.arms.find((a) => a.id === id)!;
                const off = thompson.turnedOff.includes(id) || thompson.mix[id] === 0;
                const status = off ? "off" : m.contacted < minContacts ? "insufficient" : "active";
                const pBest = Math.round((thompson.pBest[id] ?? 0) * 100);
                const leader = thompson.leader === id;
                return (
                  <td key={c} className="p-0">
                    <div
                      className={`h-full rounded-[var(--radius)] border bg-surface p-4 space-y-3 ${leader ? "border-ink ring-2 ring-brand" : "border-line"} ${off ? "opacity-60" : ""}`}
                    >
                      <div>
                        <p className="font-display text-2xl font-bold num">
                          {m.cpql.value != null ? formatCop(m.cpql.value * fx) : "—"}
                        </p>
                        <p className="text-xs text-muted">{m.cpql.value != null ? t("bridge.perQualified") : t("bridge.noData")}</p>
                      </div>

                      <p className="num text-sm" title={t("bridge.funnel")}>
                        <span className="sr-only">{t("bridge.funnel")}: </span>
                        {m.contacted} → {m.conversations} → <strong>{m.qualified}</strong>
                        <span className="text-muted">
                          {" "}
                          · {m.rejections} {t("bridge.rejections").toLowerCase()}
                        </span>
                      </p>

                      <div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">{t("bridge.pBest")}</span>
                          <span className="num font-semibold">{pBest}%</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-bg" aria-hidden>
                          <div className="h-2 rounded-full bg-ink" style={{ width: `${Math.max(pBest, 2)}%` }} />
                        </div>
                      </div>

                      <p className={`text-xs font-semibold ${STATUS[status].cls}`}>
                        <span aria-hidden>{STATUS[status].icon} </span>
                        {t(`armStatus.${status}`)}
                      </p>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
