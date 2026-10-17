import { t } from "@/i18n";
import { CAMARAS, CIIU_DESCRIBED } from "@/server/discovery/catalog";
import { NewCampaign } from "./new-campaign";

export const metadata = { title: `${t("newCampaign.title")} · ${t("app.name")}` };

export default function NewCampaignPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t("newCampaign.title")}</h1>
        <p className="text-muted">{t("newCampaign.subtitle")}</p>
      </div>
      <NewCampaign ciiuOptions={CIIU_DESCRIBED.map((c) => ({ code: c.code, label: c.label }))} camaras={CAMARAS} />
    </main>
  );
}
