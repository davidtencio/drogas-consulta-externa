import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto para evitar que Next infiera un workspace
  // equivocado cuando existen otros lockfiles fuera del repo.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
