import type { NextConfig } from "next";

// Versión única por build. Se inyecta en el cliente y en la URL del service
// worker (?v=...) para invalidar la caché de la PWA en cada despliegue.
const swVersion = process.env.NEXT_PUBLIC_SW_VERSION ?? String(Date.now());

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto para evitar que Next infiera un workspace
  // equivocado cuando existen otros lockfiles fuera del repo.
  turbopack: { root: import.meta.dirname },
  env: { NEXT_PUBLIC_SW_VERSION: swVersion },
};

export default nextConfig;
