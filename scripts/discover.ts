// Corre el descubrimiento real (RUES + SECOP) para una campaña ya creada en "Nueva campaña".
//   pnpm discover                    → la campaña más reciente
//   pnpm discover -- --campaign <id>
// Usa la configuración guardada en la campaña. Más adelante lo dispara la tarea `discover` de Trigger.dev.
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { runDiscovery } from "@/server/discovery/discover";
import { DrizzleDiscoveryStore } from "@/server/discovery/discovery-store";
import { SocrataOpenData } from "@/server/discovery/opendata";
import { env } from "@/server/env";
import { campaignConfigSchema } from "@/server/lab/config";

async function main() {
  const d = db();
  const argId = process.argv.indexOf("--campaign");
  const id = argId > 0 ? process.argv[argId + 1] : undefined;
  const [campaign] = id
    ? await d.select().from(schema.campaign).where(eq(schema.campaign.id, id))
    : await d.select().from(schema.campaign).orderBy(desc(schema.campaign.createdAt)).limit(1);
  if (!campaign) throw new Error("No hay campaña: créala en /campanas/nueva.");

  const cfg = campaignConfigSchema.parse(campaign.config);
  console.log(`Descubriendo para "${campaign.name}" (CIIU ${cfg.ciiu.join(", ")}, cámara ${cfg.ruesCamara})…`);
  const started = Date.now();
  const stats = await runDiscovery({ openData: new SocrataOpenData(env().SOCRATA_APP_TOKEN), store: new DrizzleDiscoveryStore(d) }, campaign.id, cfg);
  console.log(JSON.stringify(stats, null, 2));
  console.log(`Listo en ${((Date.now() - started) / 1000).toFixed(1)} s. Campaña ${campaign.id}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
