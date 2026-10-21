/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // Keep the Postgres driver as a runtime dependency instead of bundling it.
  experimental: { serverComponentsExternalPackages: ["pg"] },
};
export default nextConfig;
