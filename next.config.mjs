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
  // Content-Security-Policy NO va acá: necesita un nonce distinto por
  // request (script-src 'nonce-...' en vez de 'unsafe-inline'/'unsafe-eval'),
  // y headers() de next.config es estático. Se genera en
  // src/lib/supabase/middleware.ts (updateSession), que corre en cada
  // request de página.
]

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Next.js 14.x todavía requiere este flag para cargar src/instrumentation.ts
  // (se volvió estable recién en Next 15) — sin él, el archivo se ignora por
  // completo y no aparece ni en el build de standalone.
  experimental: {
    instrumentationHook: true,
  },
  // Incluir archivos de prompts .md en el standalone build (no son detectados automáticamente)
  outputFileTracingIncludes: {
    '/api/**': ['./src/lib/prompts/**'],
  },
  // Paquetes que NO deben bundlearse — se cargan como módulos nativos de Node en runtime
  // @xenova/transformers y onnxruntime-node eran del motor de embeddings
  // local (era de pre-Voyage AI) — sin uso en el código desde hace varias
  // migraciones (ver supabase/migrations/004/006/033). onnxruntime-node ni
  // siquiera es una dependencia directa. Quitados de acá y del
  // dependency del propio @xenova/transformers en package.json — era la
  // única fuente de una vulnerabilidad CRÍTICA de protobufjs (npm audit).
  serverExternalPackages: ['pdf-parse', 'mammoth', '@react-pdf/renderer'],
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
