import Link from "next/link";
import { brandInfo } from "@/lib/brandInfo";
import { useCart } from "@/components/CartProvider";
import ManageCookiesButton from "@/components/ManageCookiesButton";

const discoveryLinks = [
  { href: "/catalogue", label: "La collection" },
  { href: "/notre-histoire", label: "Notre histoire" },
  { href: "/newsletter", label: "Newsletter" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

const informationLinks = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/conditions-de-vente", label: "Conditions de vente" },
  { href: "/livraison", label: "Livraison" },
  { href: "/retours", label: "Retours et remboursements" },
  { href: "/retractation", label: "Demande de rétractation" },
  { href: "/politique-de-confidentialite", label: "Confidentialité" },
  { href: "/politique-de-cookies", label: "Politique de cookies" },
];

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}, ouvre dans un nouvel onglet`}
    >
      {children}
      <span>{label}</span>
    </a>
  );
}

export default function Footer({
  withNavigation,
}: {
  withNavigation: boolean;
}) {
  const { checkoutEnabled, shippingConfigurationLoaded } = useCart();
  return (
    <footer
      className={`storefront-footer${withNavigation ? " storefront-footer--with-nav" : ""}`}
    >
      <div className="storefront-footer-main">
        <div className="storefront-footer-brand">
          <Link prefetch={false}
            href="/"
            className="storefront-footer-wordmark"
            aria-label="MAISON MIROIR, accueil"
          >
            <span>MAISON MIROIR</span>
          </Link>
          <p>Une marque autour de la modestie, de l’identité et du lifestyle.</p>
          <div className="storefront-footer-social">
            <SocialLink href={brandInfo.instagram} label="Instagram">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <circle cx="17.5" cy="6.8" r="1" fill="currentColor" />
              </svg>
            </SocialLink>
            <SocialLink href={brandInfo.tiktok} label="TikTok">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M19.6 7.1a6.3 6.3 0 0 1-3.8-1.3v8.4a5.8 5.8 0 1 1-5-5.7v3.2a2.7 2.7 0 1 0 1.8 2.5V2.5h3.2a6.3 6.3 0 0 0 3.8 4.1v.5Z"
                />
              </svg>
            </SocialLink>
          </div>
        </div>

        <div className="storefront-footer-column">
          <h2>Découvrir</h2>
          <nav aria-label="Découvrir">
            {discoveryLinks.map(({ href, label }) => (
              <Link prefetch={false} key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="storefront-footer-column">
          <h2>Informations</h2>
          <nav aria-label="Informations">
            {informationLinks.map(({ href, label }) => (
              <Link prefetch={false} key={href} href={href}>
                {label}
              </Link>
            ))}
            <ManageCookiesButton className="storefront-footer-manage-cookies" />
          </nav>
        </div>

        <div className="storefront-footer-column storefront-footer-contact">
          <h2>Nous écrire</h2>
          <a
            className="storefront-footer-email"
            href={`mailto:${brandInfo.email}`}
          >
            {brandInfo.email}
          </a>
          {shippingConfigurationLoaded && !checkoutEnabled && (
            <p className="storefront-footer-notice">
              Les commandes ouvriront prochainement.
            </p>
          )}
        </div>
      </div>

      <div className="storefront-footer-bottom">
        <p>© 2026 MAISON MIROIR. Tous droits réservés.</p>
        <p className="storefront-footer-tagline">For Modest Girls</p>
      </div>
    </footer>
  );
}
