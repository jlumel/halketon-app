import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // better-sqlite3 es un módulo nativo Node.js: no puede ser bundleado por
  // webpack. Vercel lo instala en runtime; esto evita que el build falle.
  serverExternalPackages: ["better-sqlite3"],
  // Permite que dispositivos en la red local (celular, etc.) accedan a los
  // recursos /_next/ en dev sin que Next.js los bloquee por cross-origin.
  allowedDevOrigins: ["192.168.112.241"],
};

export default nextConfig;
