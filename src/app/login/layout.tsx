import type { Metadata } from 'next'

// page.tsx es 'use client' — la Metadata API de Next.js no funciona en
// componentes cliente, así que la metadata específica de esta ruta vive en
// este layout (patrón estándar de Next.js App Router).
export const metadata: Metadata = {
  title: 'Iniciar sesión — ProcessOS',
  description: 'Accede a tu plataforma de inteligencia de procesos operacionales.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
