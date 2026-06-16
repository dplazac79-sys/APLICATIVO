'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Usuario } from '@/types/database'

const ROL_LABELS: Record<string, string> = {
  super_admin: 'Super Administrador',
  director_proyecto: 'Director de Proyecto',
  consultor: 'Consultor',
  sponsor_cliente: 'Sponsor Cliente',
  usuario_cliente: 'Usuario Cliente',
}

interface Props {
  usuario: Usuario | null
}

export default function AppHeader({ usuario }: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = usuario?.nombre
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'U'

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-slate-800 outline-none">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="bg-indigo-600 text-white text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-sm text-slate-200 font-medium leading-tight">{usuario?.nombre ?? 'Usuario'}</p>
              <p className="text-xs text-slate-500 leading-tight">{ROL_LABELS[usuario?.rol ?? ''] ?? ''}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-slate-200 min-w-48">
            <div className="px-2 py-1.5 text-xs text-slate-500">{usuario?.email}</div>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer hover:bg-slate-700 text-red-400 hover:text-red-300"
            >
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
