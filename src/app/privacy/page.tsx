export const metadata = {
  title: "Politique de confidentialité",
};

export default function Privacy() {
  return (
    <main className="min-h-screen p-8">
      <article className="card max-w-3xl mx-auto p-10 text-sm leading-relaxed">
        <h1 className="text-2xl font-semibold mb-6">Politique de confidentialité</h1>

        <h2 className="text-lg font-semibold mt-8 mb-3">Quelles données collectons-nous ?</h2>
        <p className="mb-3" style={{ color: "var(--text-secondary)" }}>
          Lorsque vous scannez l&apos;un de nos QR codes, nous enregistrons des
          statistiques d&apos;usage <strong>anonymisées</strong> :
        </p>
        <ul className="list-disc pl-6 mb-3 space-y-1" style={{ color: "var(--text-secondary)" }}>
          <li>la date et l&apos;heure du scan ;</li>
          <li>
            une adresse IP <strong>anonymisée</strong> (le dernier octet est supprimé
            avant tout enregistrement : par exemple 93.184.216.x → 93.184.216.0) ;
          </li>
          <li>le pays et, si disponible, la ville approximative (précision ~11 km) ;</li>
          <li>le type d&apos;appareil (iPhone, Android…), le système d&apos;exploitation et le navigateur ;</li>
          <li>la langue configurée sur l&apos;appareil ;</li>
          <li>la source du trafic si elle est disponible (site référent).</li>
        </ul>
        <p className="mb-3" style={{ color: "var(--text-secondary)" }}>
          Aucune donnée permettant de vous identifier directement (nom, e-mail,
          identifiant publicitaire, adresse IP complète) n&apos;est enregistrée.
          Aucun cookie de suivi n&apos;est déposé lors du scan.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Pourquoi ?</h2>
        <p className="mb-3" style={{ color: "var(--text-secondary)" }}>
          Ces statistiques agrégées nous servent uniquement à mesurer
          l&apos;efficacité de nos supports de communication (flyers, affiches,
          salons). Base légale : intérêt légitime (art. 6.1.f RGPD).
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Combien de temps ?</h2>
        <p className="mb-3" style={{ color: "var(--text-secondary)" }}>
          Les événements de scan sont conservés au maximum 25 mois, puis supprimés.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">Vos droits</h2>
        <p className="mb-3" style={{ color: "var(--text-secondary)" }}>
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de
          rectification, d&apos;effacement et d&apos;opposition. Les données étant
          anonymisées dès la collecte, elles ne peuvent pas être reliées à une
          personne ; pour toute question, contactez-nous à l&apos;adresse
          indiquée sur notre site.
        </p>

        <p className="mt-8 text-xs" style={{ color: "var(--text-muted)" }}>
          Dernière mise à jour : {new Date().getFullYear()}
        </p>
      </article>
    </main>
  );
}
