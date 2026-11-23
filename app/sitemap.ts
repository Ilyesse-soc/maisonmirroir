import type { MetadataRoute } from "next";

const baseUrl = "https://maison-miroir.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/newsletter",
    "/catalogue",
    "/notre-histoire",
    "/faq",
    "/contact",
    "/category/sacs",
    "/product/modest-era",
    "/product/paradise-way",
  ];

  return paths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
