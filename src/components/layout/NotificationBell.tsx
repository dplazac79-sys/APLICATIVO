'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatFecha } from '@/lib/format'

interface Notificacion {
  id: string
  proyecto_id: string | null
  proceso_id: string | null
  tipo: string
  titulo: string
  cuerpo: string
  leida: boolean
  created_at: string
}

export default function NotificationBell() {
  const router = useRouter()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    fetch('/api/notificaciones')
      .then(res => res.json())
      .then(data => { if (activo) setNotificaciones(data.notificaciones ?? []) })
      .catch(() => {})
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [])

  const noLeidas = notificaciones.filter(n => !n.leida).length

  async function marcarLeida(n: Notificacion) {
    if (!n.leida) {
      setNotificaciones(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x))
      fetch(`/api/notificaciones/${n.id}`, { method: 'PATCH' }).catch(() => {})
    }
    if (n.proceso_id) {
      router.push(`/artefactos/${n.proceso_id}`)
    } else if (n.proyecto_id) {
      router.push(`/proyectos/${n.proyecto_id}`)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors outline-none" aria-label="Notificaciones">
        <Bell className="w-5 h-5" />
        {noLeidas > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-medium">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-slate-200 w-80 max-h-96 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Notificaciones</div>
        {cargando ? (
          <div className="px-3 py-4 text-sm text-slate-400">Cargando...</div>
        ) : notificaciones.length === 0 ? (
          <div className="px-3 py-4 text-sm text-slate-400">Sin notificaciones.</div>
        ) : (
          notificaciones.map(n => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => marcarLeida(n)}
              className={`cursor-pointer flex flex-col items-start gap-0.5 whitespace-normal py-2 px-3 hover:bg-slate-700 ${!n.leida ? 'bg-slate-800' : ''}`}
            >
              <div className="flex items-center gap-1.5 w-full">
                {!n.leida && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                <span className="text-sm text-slate-100 font-medium">{n.titulo}</span>
              </div>
              <p className="text-xs text-slate-400">{n.cuerpo}</p>
              <p className="text-[10px] text-slate-500">{formatFecha(n.created_at)}</p>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
