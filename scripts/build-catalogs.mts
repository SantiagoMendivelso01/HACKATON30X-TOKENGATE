// Genera los catálogos estáticos de CIIU y cámaras de comercio desde datos.gov.co.
//   node scripts/build-catalogs.mts
// Fuentes: 3kkb-6c2s (descripciones CIIU Rev. 4 A.C.) y c82u-588k (RUES: códigos y cámaras existentes).
import { writeFileSync } from "node:fs";

const get = async (ds: string, q: string) => {
  const r = await fetch(`https://www.datos.gov.co/resource/${ds}.json?$query=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error(`${ds}: ${await r.text()}`);
  return (await r.json()) as Record<string, string>[];
};

const desc = new Map<string, string>();
for (const r of await get("3kkb-6c2s", "SELECT actividad_econ_mica_y_ciiu LIMIT 1000")) {
  const m = /^[A-Z](\d{4}) \*\* (.+)$/.exec(r.actividad_econ_mica_y_ciiu ?? "");
  if (m) desc.set(m[1], m[2].replace(/\s{2,}/g, ", ").trim());
}

const codes = await get("c82u-588k", "SELECT cod_ciiu_act_econ_pri, count(*) AS n WHERE estado_matricula = 'ACTIVA' AND organizacion_juridica != 'PERSONA NATURAL' GROUP BY cod_ciiu_act_econ_pri LIMIT 2000");
const ciiu = codes
  .filter((r) => /^\d{4}$/.test(r.cod_ciiu_act_econ_pri) && r.cod_ciiu_act_econ_pri !== "0000" && r.cod_ciiu_act_econ_pri !== "9999")
  .map((r) => ({ code: r.cod_ciiu_act_econ_pri, label: desc.get(r.cod_ciiu_act_econ_pri) ?? null, activeCompanies: Number(r.n) }))
  .sort((a, b) => a.code.localeCompare(b.code));

const camaras = (await get("c82u-588k", "SELECT camara_comercio, count(*) AS n WHERE estado_matricula = 'ACTIVA' GROUP BY camara_comercio LIMIT 200"))
  .map((r) => ({ name: r.camara_comercio, activeCompanies: Number(r.n) }))
  .sort((a, b) => b.activeCompanies - a.activeCompanies);

const meta = { generatedAt: new Date().toISOString().slice(0, 10), sources: ["https://www.datos.gov.co/resource/3kkb-6c2s", "https://www.datos.gov.co/resource/c82u-588k"] };
writeFileSync(new URL("../src/server/discovery/data/ciiu.json", import.meta.url), JSON.stringify({ ...meta, ciiu }, null, 1));
writeFileSync(new URL("../src/server/discovery/data/camaras.json", import.meta.url), JSON.stringify({ ...meta, camaras }, null, 1));
console.log(`CIIU: ${ciiu.length} (${ciiu.filter((c) => c.label).length} con descripción). Cámaras: ${camaras.length}`);
