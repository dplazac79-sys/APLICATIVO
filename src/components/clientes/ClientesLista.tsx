'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, ChevronRight, Search, Users2, Briefcase, Globe2 } from 'lucide-react'

const MADUREZ_COLOR: Record<string, string> = {
  inicial: 'bg-red-950 text-red-400 border-red-800',
  'en desarrollo': 'bg-amber-950 text-amber-400 border-amber-800',
  avanzado: 'bg-emerald-950 text-emerald-400 border-emerald-800',
}

export interface ClienteRow {
  id: string
  razon_social: string
  industria: string | null
  tamano: string | null
  madurez_digital: string | null
  proyecto: { id: string; nombre: string; estado_general: string }[] | null
}

export default function ClientesLista({ clientes }: { clientes: ClienteRow[] }) {
  const [query, setQuery] = useState('')

  const stats = useMemo(() => {
    const proyectosActivos = clientes.reduce((sum, c) =>
      sum + (c.proyecto?.filter(p => p.estado_general === 'activo').length ?? 0), 0)
    const industrias = new Set(clientes.map(c => c.industria).filter(Boolean)).size
    return { totalClientes: clientes.length, proyectosActivos, industrias }
  }, [clientes])

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter(c =>
      c.razon_social.toLowerCase().includes(q) ||
      (c.industria ?? '').toLowerCase().includes(q)
    )
  }, [clientes, query])

  return (
    <div className="space-y-5">
      {/* Estadísticas del portafolio */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-none">{stats.totalClientes}</p>
            <p className="text-xs text-slate-400 mt-1">Cliente{stats.totalClientes !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-950 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-none">{stats.proyectosActivos}</p>
            <p className="text-xs text-slate-400 mt-1">Proyecto{stats.proyectosActivos !== 1 ? 's' : ''} activo{stats.proyectosActivos !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-950 flex items-center justify-center shrink-0">
            <Globe2 className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-none">{stats.industrias}</p>
            <p className="text-xs text-slate-400 mt-1">Industria{stats.industrias !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Buscador */}
      {clientes.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre o industria..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      )}

      {/* Lista */}
      {clientes.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-16 text-center">
            <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">No hay clientes registrados aún.</p>
            <Link href="/clientes/nuevo">
              <button className="mt-4 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg px-4 py-2 text-sm transition-colors">
                Crear primer cliente
              </button>
            </Link>
          </CardContent>
        </Card>
      ) : filtrados.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-12 text-center">
            <Search className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Ningún cliente coincide con &ldquo;{query}&rdquo;.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtrados.map(cliente => {
            const proyectosActivos = cliente.proyecto?.filter(p => p.estado_general === 'activo').length ?? 0
            const sinProyecto = proyectosActivos === 0

            return (
              <Link key={cliente.id} href={`/clientes/${cliente.id}`}>
                <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-950 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-white font-medium">{cliente.razon_social}</h3>
                          {cliente.madurez_digital && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${MADUREZ_COLOR[cliente.madurez_digital] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                              Madurez: {cliente.madurez_digital}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {cliente.industria && (
                            <span className="text-sm text-slate-400">{cliente.industria}</span>
                          )}
                          {cliente.tamano && (
                            <span className="text-sm text-slate-400">· {cliente.tamano}</span>
                          )}
                          <span className={`text-sm flex items-center gap-1 ${sinProyecto ? 'text-amber-500' : 'text-slate-400'}`}>
                            · {sinProyecto && <Users2 className="w-3 h-3" />}
                            {proyectosActivos} proyecto{proyectosActivos !== 1 ? 's' : ''} activo{proyectosActivos !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
