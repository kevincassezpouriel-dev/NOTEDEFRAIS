import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growth Studio — la plateforme de croissance Minggle",
  description:
    "Plateforme auto-hébergée de QR codes dynamiques : redirection intelligente App Store / Google Play, tracking respectueux du RGPD, tableau de bord temps réel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
