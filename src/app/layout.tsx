import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'ProcessOS — AICOUNTS Consultores',
  description: 'Plataforma de inteligencia de procesos operacionales',
}

// Sin esto, los navegadores móviles renderizan la página a un ancho virtual
// de escritorio (~980px) y la reducen — anula por completo el trabajo
// responsive que ya existe en el código (sidebar tipo drawer en mobile,
// breakpoints md: en toda la app), que nunca llega a activarse en un
// teléfono real. Hallazgo de auditoría de UX/UI.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`dark ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
