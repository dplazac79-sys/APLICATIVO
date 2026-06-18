/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Supabase realtime + auth
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.voyageai.com",
      // Estilos inline de Tailwind + shadcn
      "style-src 'self' 'unsafe-inline'",
      // Scripts: Next.js necesita unsafe-inline en desarrollo; en prod se usa nonce
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // @xenova/transformers usa binarios nativos (onnxruntime-node) que webpack
    // no puede empaquetar — se mantienen como dependencias externas de Node.js
    serverComponentsExternalPackages: ['@xenova/transformers', 'onnxruntime-node', '@react-pdf/renderer'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
