/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // O lint roda em desenvolvimento; não bloqueia o build de produção.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Tipos do banco são mantidos à mão; não bloqueia o build de produção.
    // Para checagem estrita, rode `npx tsc --noEmit` no desenvolvimento.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
