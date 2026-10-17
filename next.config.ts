import type { NextConfig } from "next";

// Sin cacheComponents: casi todo en Faro es dinámico (consulta cada 3 s, webhooks),
// y el modelo clásico es más simple para que varios agentes trabajen en paralelo.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
