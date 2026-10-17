"use client";

import { useRouter } from "next/navigation";
import { t } from "@/i18n";

export function CampaignSwitcher({ campaigns, current, basePath = "/" }: { campaigns: { id: string; name: string }[]; current: string; basePath?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t("bridge.switchCampaign")}</span>
      <select
        value={current}
        onChange={(e) => router.push(`${basePath}?c=${e.target.value}`)}
        className="max-w-[min(32rem,80vw)] truncate rounded-[var(--radius)] border border-line bg-surface px-3 py-1.5 text-sm"
      >
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
