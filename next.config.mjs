import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Next.js rejects `export *` in client-boundary modules; CopilotKit's v2
    // barrel has two. Alias it to the patched copy (see scripts/patch-copilotkit.mjs).
    config.resolve.alias = {
      ...config.resolve.alias,
      "@copilotkit/react-core/v2$": path.resolve(
        "./node_modules/@copilotkit/react-core/dist/v2/index.patched.mjs"
      ),
    };
    return config;
  },
};

export default nextConfig;
