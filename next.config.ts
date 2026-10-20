import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image builds with DOCKER_BUILD=1 to emit the standalone
  // server bundle (see Dockerfile). Local `npm start` keeps the regular
  // build output.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  // better-sqlite3 loads its native binding at runtime — make sure it's
  // traced into the standalone output instead of being dropped.
  outputFileTracingIncludes: { "/*": ["node_modules/better-sqlite3/**/*"] },
  serverExternalPackages: ["better-sqlite3"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      "*.md": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;