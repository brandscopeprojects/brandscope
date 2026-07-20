/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Regulatory document uploads (PDF) flow through a server action, which
    // defaults to a 1MB body cap — raise it for real regulator filings.
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
