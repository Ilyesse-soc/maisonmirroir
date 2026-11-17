"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { CartProvider } from "@/components/CartProvider";
import { usePathname } from "next/navigation";

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (
    pathname.startsWith("/77774555474447777554555") ||
    pathname === "/" ||
    pathname === "/connexion" ||
    pathname.startsWith("/newsletter") ||
    pathname === "/confidentialite" ||
    pathname === "/mentions-legales" ||
    pathname === "/politique-de-confidentialite" ||
    pathname === "/politique-de-cookies" ||
    pathname.startsWith("/admin")
  )
    return <>{children}</>;
  return (
    <CartProvider>
      <Navbar />
      <main style={{ minHeight: "100vh" }}>{children}</main>
      <Footer />
      <CartDrawer />
    </CartProvider>
  );
}
