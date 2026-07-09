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
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.voyageai.com https://*.sentry.io https://o4511589511528448.ingest.us.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self'",
      "frame-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "worker-src 'self' blob:",
    ].join('; '),
  },
]

const nextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // Incluir archivos de prompts .md en el standalone build (no son detectados automáticamente)
  outputFileTracingIncludes: {
    '/api/**': ['./src/lib/prompts/**'],
  },
  // Paquetes que NO deben bundlearse — se cargan como módulos nativos de Node en runtime
  serverExternalPackages: ['pdf-parse', 'mammoth', '@xenova/transformers', 'onnxruntime-node', '@react-pdf/renderer'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Forzar externalización a nivel webpack — pdf-parse y mammoth son CJS nativos
      // que no se pueden bundlear correctamente en Next.js standalone
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        'pdf-parse',
        'mammoth',
      ]
    }
    return config
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
