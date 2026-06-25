'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Lock, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'

type FaseItem = { label: string; done: boolean }
type Fase = {
  id: number
  nombre: string
  descripcion: string
  icono: string
  color: string
  href: string
  status: 'completada' | 'activa' | 'bloqueada'
  progreso: number
  items: FaseItem[]
}

const COLOR_MAP: Record<string, { ring: string; bar: string; badge: string; text: string; glow: string }> = {
  emerald: { ring: 'border-emerald-500/50', bar: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  blue:    { ring: 'border-blue-500/50',    bar: 'bg-blue-500',    badge: 'bg-blue-500/20 text-blue-300',    text: 'text-blue-400',    glow: 'shadow-blue-500/20' },
  violet:  { ring: 'border-violet-500/50',  bar: 'bg-violet-500',  badge: 'bg-violet-500/20 text-violet-300',  text: 'text-violet-400',  glow: 'shadow-violet-500/20' },
  amber:   { ring: 'border-amber-500/50',   bar: 'bg-amber-500',   badge: 'bg-amber-500/20 text-amber-300',   text: 'text-amber-400',   glow: 'shadow-amber-500/20' },
  rose:    { ring: 'border-rose-500/50',    bar: 'bg-rose-500',    badge: 'bg-rose-500/20 text-rose-300',    text: 'text-rose-400',    glow: 'shadow-rose-500/20' },
  cyan:    { ring: 'border-cyan-500/50',    bar: 'bg-cyan-500',    badge: 'bg-cyan-500/20 text-cyan-300',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/20' },
}

export default function FaseWorkflow({ fases, compact }: { fases: Fase[]; compact?: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(
    fases.find(f => f.status === 'activa')?.id ?? null
  )

  const totalFases = fases.length
  const completadas = fases.filter(f => f.status === 'completada').length
  const pct = Math.round((completadas / totalFases) * 100)

  return (
    <div className="space-y-4">
      {/* Barra de progreso global */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-white">Progreso del proyecto</p>
            <p className="text-xs text-slate-500 mt-0.5">{completadas} de {totalFases} fases completadas</p>
          </div>
          <span className="text-2xl font-bold text-white">{pct}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex mt-3 gap-1">
          {fases.map(f => {
            const c = COLOR_MAP[f.color]
            return (
              <div
                key={f.id}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  f.status === 'completada' ? c.bar :
                  f.status === 'activa' ? `${c.bar} opacity-50` :
                  'bg-slate-800'
                }`}
              />
            )
          })}
        </div>
      </div>

      {/* Fases — grid 3 columnas cuando hay 6 fases y no es compacto */}
      <div className={compact ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'}>
      {fases.map((fase, idx) => {
        const c = COLOR_MAP[fase.color]
        const isOpen = expanded === fase.id
        const bloqueada = fase.status === 'bloqueada'
        const completada = fase.status === 'completada'

        return (
          <div
            key={fase.id}
            className={`relative border rounded-xl transition-all duration-200 ${
              bloqueada
                ? 'border-slate-800 bg-slate-900/50 opacity-60'
                : completada
                ? `border-slate-700 bg-slate-900 ${isOpen ? `${c.ring} shadow-lg ${c.glow}` : ''}`
                : `${c.ring} bg-slate-900 shadow-lg ${c.glow}`
            }`}
          >
            {/* Línea conectora solo en layout compacto (1 columna) */}
            {compact && idx < fases.length - 1 && (
              <div className="absolute left-7 -bottom-4 w-0.5 h-4 bg-slate-700 z-10" />
            )}

            <button
              onClick={() => !bloqueada && setExpanded(isOpen ? null : fase.id)}
              disabled={bloqueada}
              className="w-full text-left p-5 flex items-center gap-4"
            >
              {/* Icono / estado */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                bloqueada ? 'border-slate-700 bg-slate-800' :
                completada ? `border-slate-600 bg-slate-800` :
                `${c.ring} bg-slate-800`
              }`}>
                {bloqueada ? '🔒' : fase.icono}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-mono">F{fase.id}</span>
                  <span className={`text-sm font-semibold ${bloqueada ? 'text-slate-500' : 'text-white'}`}>
                    {fase.nombre}
                  </span>
                  {completada && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Completada
                    </span>
                  )}
                  {fase.status === 'activa' && (
                    <span className={`text-xs ${c.badge} px-2 py-0.5 rounded-full`}>
                      En curso
                    </span>
                  )}
                  {bloqueada && (
                    <span className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Bloqueada
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{fase.descripcion}</p>

                {/* Mini progress bar */}
                {!bloqueada && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${c.bar} rounded-full transition-all duration-500`}
                        style={{ width: `${fase.progreso}%` }}
                      />
                    </div>
                    <span className={`text-xs ${c.text} shrink-0`}>{fase.progreso}%</span>
                  </div>
                )}
              </div>

              {!bloqueada && (
                <div className="shrink-0 text-slate-500">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              )}
            </button>

            {/* Detalle expandido */}
            {isOpen && !bloqueada && (
              <div className="px-5 pb-5 space-y-4">
                <div className={`h-px bg-slate-800`} />

                {/* Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {fase.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        item.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                      }`}>
                        {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-xs ${item.done ? 'text-slate-300' : 'text-slate-500'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href={fase.href}
                  className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg ${c.badge} border ${c.ring} hover:opacity-80 transition-opacity`}
                >
                  {completada ? 'Ver módulo' : 'Ir al módulo'} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}
