"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { t } from "@/i18n";

export function OperatorNav() {
  const path = usePathname();
  // Conserva la campaña que se está viendo al pasar entre el puente de mando y los leads.
  const c = useSearchParams().get("c");
  const withCampaign = (href: string) => (c ? `${href}?c=${c}` : href);
  const items = [
    { href: withCampaign("/"), match: (p: string) => p === "/", label: t("nav.bridge") },
    { href: withCampaign("/leads"), match: (p: string) => p.startsWith("/leads"), label: t("nav.leads") },
    { href: "/campanas/nueva", match: (p: string) => p.startsWith("/campanas/nueva"), label: t("nav.newCampaign") },
  ];
  return (
    <nav aria-label="Principal" className="flex gap-1 text-sm">
      {items.map((i) => {
        const active = i.match(path);
        return (
          <Link
            key={i.label}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium ${active ? "bg-chrome-2 text-chrome-ink" : "text-chrome-muted hover:text-chrome-ink"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
