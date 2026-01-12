/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.edgestore.dev",
      },
      {
        protocol: "https",
        hostname: "pub-016cea187e65447bbd8c605758a5dfdd.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // Allow images that resolve to private IPs (some CDNs/R2 may do this)
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    // missingSuspenseWithCSRBailout: false,
  },
  // Skip image optimization for external URLs that may resolve to private IPs
  async headers() {
    return [];
  },
};

module.exports = nextConfig;

