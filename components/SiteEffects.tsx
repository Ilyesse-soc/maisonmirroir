"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export default function SiteEffects() {
  const pathname = usePathname();
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll(".mm-reveal")
      .forEach((element) => observer.observe(element));
    const update = () =>
      document
        .getElementById("mm-navbar")
        ?.classList.toggle("scrolled", window.scrollY > 50);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, [pathname]);
  return null;
}
