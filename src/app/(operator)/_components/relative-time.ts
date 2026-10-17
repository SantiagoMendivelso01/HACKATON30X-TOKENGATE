import { t } from "@/i18n";

export function relativeTime(d: Date, now = new Date()): string {
  const min = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (min < 1) return t("time.justNow");
  if (min < 60) return t("time.minutesAgo", { n: min });
  return t("time.hoursAgo", { n: Math.round(min / 60) });
}
