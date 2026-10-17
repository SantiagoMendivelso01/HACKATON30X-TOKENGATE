import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { OperatorNav } from "./_components/operator-nav";

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="bg-chrome text-chrome-ink">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-6 py-3">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <span aria-hidden className="inline-block size-3 rounded-[3px] bg-brand" />
            {t("app.name")}
          </Link>
          <Suspense fallback={null}>
            <OperatorNav />
          </Suspense>
          <p className="ml-auto hidden text-xs text-chrome-muted sm:block">{t("app.builtFor")}</p>
        </div>
      </header>
      {children}
    </>
  );
}
