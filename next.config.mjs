/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // @xenova/transformers usa binarios nativos (onnxruntime-node) que webpack
    // no puede empaquetar — se mantienen como dependencias externas de Node.js
    serverComponentsExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
  },
}

export default nextConfig
