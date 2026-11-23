import "./globals.css";
import "./launch-fonts.css";
import "./storefront.css";
import SiteEffects from "@/components/SiteEffects";
import { headers } from "next/headers";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import SiteShell from "@/components/SiteShell";
import { fonts, theme } from "@/lib/uiStyles";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEWSLETTER_SITE_URL || "http://localhost:3000",
  ),
  title: "MAISON MIROIR - Première collection",
  description:
    "Découvrez Modest Era et Paradise Way, les deux tote bags de la première collection MAISON MIROIR.",
  openGraph: {
    title: "MAISON MIROIR - Plus qu’un sac, une identité",
    description: "Deux tote bags, un même désir : porter un message qui nous ressemble.",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/collection/collection-hero.webp",
        width: 941,
        height: 1672,
        alt: "Une femme portant un tote bag MAISON MIROIR",
      },
    ],
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await headers();
  return (
    <html
      lang="fr"
      style={
        {
          scrollBehavior: "smooth",
          ["--gold"]: theme.gold,
          ["--gold-light"]: theme.goldLight,
          ["--gold-dark"]: theme.goldDark,
          ["--cream"]: theme.cream,
          ["--cream-dark"]: theme.creamDark,
          ["--marble"]: theme.marble,
          ["--text-dark"]: theme.textDark,
          ["--text-mid"]: theme.textMid,
          ["--text"]: theme.textDark,
          ["--mid"]: theme.textMid,
        } as CSSProperties
      }
    >
      <body
        style={{
          margin: 0,
          backgroundColor: theme.marble,
          color: theme.textDark,
          fontFamily: fonts.body,
          fontWeight: 300,
          letterSpacing: "0.02em",
        }}
      >
        <SiteShell shopOpen={process.env.SHOP_OPEN === "true"}>
          {children}
        </SiteShell>
        <SiteEffects />
      </body>
    </html>
  );
}
