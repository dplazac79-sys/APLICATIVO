import type { Metadata } from 'next'

// page.tsx es 'use client' — la Metadata API de Next.js no funciona en
// componentes cliente, así que la metadata específica de esta ruta vive en
// este layout (patrón estándar de Next.js App Router).
export const metadata: Metadata = {
  title: 'Iniciar sesión — ProcessOS',
  description: 'Accede a tu plataforma de inteligencia de procesos operacionales.',
}

// CRÍTICO: la CSP con nonce (src/lib/supabase/middleware.ts) genera un nonce
// aleatorio distinto en cada request. Next.js prerenderiza estáticamente
// /login por defecto (no tiene datos dinámicos) — el nonce quedaba
// "horneado" en el HTML estático en build time, pero cada response real
// llevaba un nonce NUEVO en el header Content-Security-Policy. El
// navegador comparaba el nonce del <script> (viejo, del build) contra el
// del header (nuevo, de ese request) — nunca coincidían, así que TODOS los
// scripts de la página quedaban bloqueados por CSP, incluyendo el bundle
// que maneja el submit del formulario de login. Resultado: el botón
// "Ingresar al sistema" no hacía nada, ningún POST a /api/auth/login se
// disparaba jamás. force-dynamic obliga a regenerar el HTML (y el nonce)
// en cada request, sincronizado con el header real de esa misma respuesta.
export const dynamic = 'force-dynamic'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
