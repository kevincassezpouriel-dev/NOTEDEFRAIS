/**
 * Applique le schéma Prisma à la base au moment du build (Vercel).
 * - Sans DATABASE_URL : on passe, avec un avertissement.
 * - Base injoignable (ex. build Docker) : on avertit sans casser le build.
 */
const { execSync } = require("node:child_process");

if (!process.env.DATABASE_URL) {
  console.warn("⚠ DATABASE_URL absente : schéma non appliqué à la base.");
  process.exit(0);
}

try {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
  console.log("✓ Schéma de base de données appliqué.");
} catch {
  console.warn(
    "⚠ Impossible d'appliquer le schéma (base injoignable ?) — le build continue."
  );
}
