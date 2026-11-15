/** @type {import('next').NextConfig} */
module.exports = {
  output: "standalone",
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: {},
  outputFileTracingExcludes: {
    "/**": [
      "./.qa/**",
      "./.npm-cache/**",
      "./.venv/**",
      "./archive/**",
      "./.env*",
      "./data/**",
    ],
  },
  experimental: { serverActions: { bodySizeLimit: "64kb" } },
};
