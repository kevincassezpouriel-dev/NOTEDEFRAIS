import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CandidatureForm from "@/components/CandidatureForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const annonce = await prisma.annonce.findUnique({
    where: { slug },
    select: { titre: true, quartier: true },
  });
  return {
    title: annonce ? `${annonce.titre} — Minggle` : "Colocation — Minggle",
    description: annonce ? `Chambre en colocation ${annonce.quartier ?? "à Compiègne"}.` : undefined,
  };
}

/**
 * Fiche publique d'une chambre. Sélection volontairement restreinte des
 * champs : aucune donnée du propriétaire ne doit pouvoir fuiter ici.
 */
export default async function AnnoncePage({ params }: Props) {
  const { slug } = await params;
  const annonce = await prisma.annonce.findUnique({
    where: { slug },
    select: {
      slug: true,
      titre: true,
      statut: true,
      quartier: true,
      adresseApprox: true,
      loyer: true,
      charges: true,
      caution: true,
      surfaceChambre: true,
      surfaceTotale: true,
      meublee: true,
      dateDispo: true,
      dureeMin: true,
      nbColocataires: true,
      profilColocataires: true,
      description: true,
      equipements: true,
      photos: true,
    },
  });
  if (!annonce || annonce.statut !== "en_ligne") notFound();

  const photos = (annonce.photos ?? "")
    .split(/\s*\n\s*/)
    .map((p) => p.trim())
    .filter((p) => /^https?:\/\//.test(p))
    .slice(0, 6);

  const ligne = (label: string, valeur: string | null) =>
    valeur ? (
      <div className="flex justify-between gap-4 py-2 border-b" style={{ borderColor: "var(--grid)" }}>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="text-sm font-medium text-right">{valeur}</span>
      </div>
    ) : null;

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <article className="max-w-2xl mx-auto">
        <Link href="/colocations" className="text-sm underline" style={{ color: "var(--text-muted)" }}>
          ← Toutes les colocations
        </Link>

        <h1 className="text-3xl font-semibold mt-4 mb-1">{annonce.titre}</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          {[annonce.quartier, annonce.adresseApprox].filter(Boolean).join(" · ") || "Compiègne"}
        </p>

        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-6">
            {photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                className="w-full rounded-xl border"
                style={{ aspectRatio: "4/3", objectFit: "cover", borderColor: "var(--border)" }}
              />
            ))}
          </div>
        )}

        <div className="card p-5 mb-6">
          {ligne("Loyer", annonce.loyer != null ? `${annonce.loyer} €/mois` : null)}
          {ligne("Charges", annonce.charges != null ? `${annonce.charges} €/mois` : null)}
          {ligne("Dépôt de garantie", annonce.caution != null ? `${annonce.caution} €` : null)}
          {ligne("Chambre", annonce.surfaceChambre ? `${annonce.surfaceChambre} m²` : null)}
          {ligne("Logement", annonce.surfaceTotale ? `${annonce.surfaceTotale} m²` : null)}
          {ligne("Meublée", annonce.meublee ? "Oui" : "Non")}
          {ligne(
            "Disponible",
            annonce.dateDispo
              ? new Date(annonce.dateDispo).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : null
          )}
          {ligne("Durée minimum", annonce.dureeMin)}
          {ligne("Colocataires", annonce.nbColocataires ? `${annonce.nbColocataires}` : null)}
        </div>

        {annonce.description && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">La chambre</h2>
            <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
              {annonce.description}
            </p>
          </section>
        )}

        {annonce.profilColocataires && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Qui vit déjà là</h2>
            <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
              {annonce.profilColocataires}
            </p>
          </section>
        )}

        {annonce.equipements && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Équipements</h2>
            <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
              {annonce.equipements}
            </p>
          </section>
        )}

        <CandidatureForm annonceSlug={annonce.slug} />
      </article>
    </main>
  );
}
