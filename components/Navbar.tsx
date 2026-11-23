"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/CartProvider";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/catalogue", label: "Boutique" },
  { href: "/notre-histoire", label: "Notre histoire" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/#newsletter", label: "Newsletter" },
];

export default function Navbar({ homeOverlay = false }: { homeOverlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [footerInView, setFooterInView] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const { itemCount, openDrawer } = useCart();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const nav = document.getElementById("mm-navbar");
    const footer = document.querySelector(".storefront-footer");
    if (!nav || !footer) return;

    let frame = 0;
    const updateFooterOverlap = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const footerRect = footer.getBoundingClientRect();
        const footerIsVisible =
          window.innerWidth < 1024 &&
          footerRect.top < window.innerHeight &&
          footerRect.bottom > 0;
        setFooterInView((current) =>
          current === footerIsVisible ? current : footerIsVisible,
        );
        if (footerIsVisible) {
          setMenuOpen(false);
          if (
            nav.contains(document.activeElement) &&
            document.activeElement instanceof HTMLElement
          ) {
            document.activeElement.blur();
          }
        }
      });
    };

    updateFooterOverlap();
    window.addEventListener("scroll", updateFooterOverlap, { passive: true });
    window.addEventListener("resize", updateFooterOverlap);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateFooterOverlap);
      window.removeEventListener("resize", updateFooterOverlap);
    };
  }, [pathname]);

  useEffect(() => {
    const update = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) {
        setMenuOpen(false);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const openCart = () => {
    setMenuOpen(false);
    openDrawer();
  };

  return (
    <>
      <nav
        id="mm-navbar"
        className={`mm-navbar${homeOverlay ? " mm-navbar--home" : ""}${scrolled ? " is-scrolled" : ""}${footerInView ? " is-footer-visible" : ""}`}
        aria-label="Navigation principale"
        aria-hidden={footerInView || undefined}
      >
        <div className="mm-navbar-inner">
          <Link
            href="/"
            className="mm-navbar-brand"
            aria-label="MAISON MIROIR, accueil"
          >
            <span className="mm-navbar-wordmark">MAISON MIROIR</span>
          </Link>

          {isDesktop ? (
            <div className="mm-navbar-actions">
              <div className="mm-navbar-links">
                {links.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <button
                type="button"
                onClick={openCart}
                className="mm-navbar-cart"
                aria-label={`Ouvrir le panier, ${itemCount} article${itemCount === 1 ? "" : "s"}`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5.5 8.5h13l1 12h-15l1-12Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.25"
                  />
                  <path
                    d="M9 9V6a3 3 0 0 1 6 0v3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.25"
                  />
                </svg>
                <span>Panier</span>
                <span className="mm-navbar-cart-count">{itemCount}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`mm-navbar-menu${menuOpen ? " is-open" : ""}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={menuOpen}
              aria-controls="mm-mobile-menu"
            >
              <span />
              <span />
            </button>
          )}
        </div>

        {!isDesktop && menuOpen && (
          <div className="mm-mobile-menu" id="mm-mobile-menu">
            <div className="mm-mobile-menu-links">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              className="mm-navbar-cart"
              onClick={openCart}
              aria-label={`Ouvrir le panier, ${itemCount} article${itemCount === 1 ? "" : "s"}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5.5 8.5h13l1 12h-15l1-12Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                />
                <path
                  d="M9 9V6a3 3 0 0 1 6 0v3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                />
              </svg>
              <span>Panier</span>
              <span className="mm-navbar-cart-count">{itemCount}</span>
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
