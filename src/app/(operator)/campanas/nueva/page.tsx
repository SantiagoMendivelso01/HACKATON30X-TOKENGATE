import { t } from "@/i18n";
import { CAMARAS, CIIU_DESCRIBED } from "@/server/discovery/catalog";
import { NewCampaign } from "./new-campaign";

export default function NewCampaignPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-6">
      <h1 className="text-2xl font-bold">{t("newCampaign.title")}</h1>
      <NewCampaign ciiuOptions={CIIU_DESCRIBED.map((c) => ({ code: c.code, label: c.label }))} camaras={CAMARAS} />
    </main>
  );
}
