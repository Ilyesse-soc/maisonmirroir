import "./globals.css";
import "./launch-fonts.css";
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
  title: "Maison Miroir — Modesty, Identity, Lifestyle",
  description:
    "For the girls with haya and big dreams. Rejoignez la liste privée Maison Miroir et découvrez notre première collection en avant-première.",
  openGraph: {
    title: "Maison Miroir — A new chapter begins",
    description: "Une nouvelle vision de la mode, avec élégance et pudeur.",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/launch/reference.jpg",
        width: 1024,
        height: 1536,
        alt: "Maison Miroir — nouvelle collection",
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
        <SiteShell>{children}</SiteShell>
        <SiteEffects />
      </body>
    </html>
  );
}
