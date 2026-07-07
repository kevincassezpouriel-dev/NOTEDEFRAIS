import Link from "next/link";

export const metadata = {
  title: "Découvrez notre application",
};

/**
 * Page de présentation par défaut : c'est ici qu'atterrissent les visiteurs
 * Windows / Mac / Linux (et les mobiles si les liens de stores ne sont pas
 * encore renseignés). Personnalisez librement cette page — ou renseignez
 * une « URL de repli » différente dans l'admin pour pointer ailleurs.
 */
export default function AppPresentation() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <div className="text-6xl mb-6">📱</div>
        <h1 className="text-4xl font-semibold mb-4">Notre application mobile</h1>
        <p className="text-lg mb-10" style={{ color: "var(--text-secondary)" }}>
          Scannez le QR code depuis votre téléphone pour être redirigé
          automatiquement vers votre store, ou utilisez les liens ci-dessous.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <a href="/download" className="btn btn-primary text-base px-6 py-3">
             Télécharger sur l&apos;App Store
          </a>
          <a href="/download" className="btn btn-primary text-base px-6 py-3">
            ▶ Disponible sur Google Play
          </a>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/privacy" className="underline">
            Politique de confidentialité
          </Link>
        </p>
      </div>
    </main>
  );
}
