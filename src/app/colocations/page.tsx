import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Colocations à Compiègne — Minggle",
  description:
    "Les chambres disponibles en colocation à Compiègne, sélectionnées et suivies par Minggle.",
};

function euros(n: number | null) {
  return n != null ? `${n} €` : "—";
}

/** Liste publique des chambres en ligne. Aucune donnée propriétaire. */
export default async function ColocationsPage() {
  const annonces = await prisma.annonce.findMany({
    where: { statut: "en_ligne" },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      titre: true,
      quartier: true,
      loyer: true,
      charges: true,
      surfaceChambre: true,
      meublee: true,
      dateDispo: true,
      nbColocataires: true,
      description: true,
    },
  });

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Colocations à Compiègne</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Des chambres vérifiées, publiées et suivies par Minggle. Tu postules ici,
            on lit ton profil, et on te présente à la coloc si ça matche.
          </p>
        </header>

        {annonces.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucune chambre disponible pour le moment — reviens très vite, on en publie
            chaque semaine.
          </p>
        ) : (
          <div className="space-y-4">
            {annonces.map((a) => (
              <Link key={a.slug} href={`/colocations/${a.slug}`} className="card block p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{a.titre}</h2>
                    <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {[
                        a.quartier,
                        a.surfaceChambre ? `${a.surfaceChambre} m² de chambre` : null,
                        a.nbColocataires ? `${a.nbColocataires} colocs` : null,
                        a.meublee ? "meublée" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-semibold">{euros(a.loyer)}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {a.charges ? `+ ${a.charges} € de charges` : "charges comprises"}
                    </p>
                  </div>
                </div>
                {a.description && (
                  <p className="text-sm mt-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                    {a.description}
                  </p>
                )}
                <p className="text-xs mt-3" style={{ color: "var(--accent)" }}>
                  Voir la chambre et postuler →
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
