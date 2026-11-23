"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { CartProvider } from "@/components/CartProvider";
import { usePathname } from "next/navigation";

export default function SiteShell({
  children,
  shopOpen,
}: {
  children: React.ReactNode;
  shopOpen: boolean;
}) {
  const pathname = usePathname();
  const isPrivateRoute =
    pathname.startsWith("/77774555474447777554555") ||
    pathname.startsWith("/admin");
  if (isPrivateRoute)
    return <>{children}</>;

  const showNavigation = !(
    pathname === "/connexion" ||
    pathname.startsWith("/newsletter/") ||
    pathname === "/confidentialite" ||
    pathname === "/mentions-legales" ||
    pathname === "/politique-de-confidentialite" ||
    pathname === "/politique-de-cookies"
  );

  return (
    <CartProvider syncEnabled={shopOpen && showNavigation}>
      <div className="site-shell">
        {showNavigation && <Navbar homeOverlay={pathname === "/"} />}
        <main className="site-shell-main">{children}</main>
        <Footer withNavigation={showNavigation} />
      </div>
      {showNavigation && <CartDrawer />}
    </CartProvider>
  );
}
