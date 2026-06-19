'use client'

import { useState } from 'react'
import AppSidebar from './AppSidebar'
import AppHeader from './AppHeader'
import type { RolTipo } from '@/types/database'
import type { Usuario } from '@/types/database'

interface Props {
  usuario: Usuario | null
  rol: RolTipo
  children: React.ReactNode
}

export default function AppShell({ usuario, rol, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <AppSidebar
        rol={rol}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AppHeader
          usuario={usuario}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
