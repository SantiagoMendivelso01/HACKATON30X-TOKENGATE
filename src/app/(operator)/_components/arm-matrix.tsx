import { t } from "@/i18n";
import { CHANNELS, SOURCES, armId } from "@/server/lab/config";
import type { CampaignMetrics } from "@/server/lab/metrics";
import { formatCop } from "@/server/lab/recommendation";
import type { ThompsonResult } from "@/server/lab/thompson";

export function ArmMatrix({ metrics, thompson, fx, minContacts }: { metrics: CampaignMetrics; thompson: ThompsonResult; fx: number; minContacts: number }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="p-2 text-left text-muted font-normal" />
          {CHANNELS.map((c) => (
            <th key={c} scope="col" className="p-2 text-left font-semibold">
              {t(`channel.${c}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SOURCES.map((s) => (
          <tr key={s} className="border-t border-line align-top">
            <th scope="row" className="p-2 text-left font-semibold">
              {t(`source.${s}`)}
            </th>
            {CHANNELS.map((c) => {
              const id = armId({ source: s, channel: c });
              const m = metrics.arms.find((a) => a.id === id)!;
              const off = thompson.turnedOff.includes(id) || thompson.mix[id] === 0;
              const status = off ? "off" : m.contacted < minContacts ? "insufficient" : "active";
              return (
                <td key={c} className="p-2">
                  <div className="rounded-[var(--radius)] border border-line bg-surface p-3 space-y-1">
                    <p className="num">
                      {m.contacted} → {m.conversations} → <strong>{m.qualified}</strong>
                      <span className="text-muted"> · {m.rejections} {t("bridge.rejections").toLowerCase()}</span>
                    </p>
                    <p className="num">
                      {t("bridge.cpql")}: {m.cpql.value != null ? formatCop(m.cpql.value * fx) : t("bridge.noData")}
                    </p>
                    <p className="num">
                      {t("bridge.pBest")}: {Math.round((thompson.pBest[id] ?? 0) * 100)}%
                    </p>
                    <p className={`text-xs font-medium ${status === "off" ? "text-off" : status === "insufficient" ? "text-waiting" : "text-done"}`}>
                      {status === "off" ? "■ " : status === "insufficient" ? "◌ " : "● "}
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
  );
}
