import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

let instance: ReturnType<typeof create> | null = null;

function create() {
  // prepare: false porque el pooler de Supabase (modo transacción) no admite sentencias preparadas.
  // La base de demo (PGlite) corta conexiones abiertas en paralelo: ahí DATABASE_POOL_MAX=1.
  const client = postgres(env().DATABASE_URL, { prepare: false, max: env().DATABASE_POOL_MAX });
  return drizzle(client, { schema });
}

/** Cliente perezoso: no se conecta hasta el primer uso. */
export function db() {
  instance ??= create();
  return instance;
}

export { schema };
