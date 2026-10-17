import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

let instance: ReturnType<typeof create> | null = null;

function create() {
  // prepare: false porque el pooler de Supabase (modo transacción) no admite sentencias preparadas.
  const client = postgres(env().DATABASE_URL, { prepare: false, max: 5 });
  return drizzle(client, { schema });
}

/** Cliente perezoso: no se conecta hasta el primer uso. */
export function db() {
  instance ??= create();
  return instance;
}

export { schema };
