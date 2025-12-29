import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'export',
  // Désactiver l'optimisation des images pour l'export statique
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
