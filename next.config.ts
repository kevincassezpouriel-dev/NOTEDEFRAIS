import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // « standalone » sert uniquement à l'image Docker (server.js autonome).
  // Sur Vercel il CASSE le rendu d'images /api/og (les WASM de Satori/resvg
  // ne sont pas embarqués dans la fonction) → activé seulement quand le
  // build Docker le demande explicitement.
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  // Les polices de marque lues par la route /api/og doivent être tracées
  // dans le bundle de la fonction serverless.
  outputFileTracingIncludes: {
    "/api/og/[slug]": ["./public/fonts/*.ttf"],
  },
};

export default nextConfig;
