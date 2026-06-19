'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Upload, Zap, Database, Users, BarChart3, Bot, Globe, ArrowRight, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface ProcesoAprobado {
  id: string
  nombre_proceso: string
  macroproceso: string | null
  numero_en_macroproceso: number | null
  total_en_macroproceso: number | null
  valor_negocio: string | null
  aprobado_at: string | null
  proyecto_id: string
}

interface Proyecto {
  id: string
  nombre: string
  estado_general: string
  fase_actual: number
}

const SISTEMAS_IMPL: Array<{
  id: string
  nombre: string
  descripcion: string
  icon: React.ReactNode
  color: string
}> = [
  { id: 'erp', nombre: 'ERP', descripcion: 'SAP, Oracle, Dynamics — gestión de recursos', icon: <Database className="w-5 h-5" />, color: 'border-blue-800 bg-blue-950/20 text-blue-300' },
  { id: 'crm', nombre: 'CRM', descripcion: 'Salesforce, HubSpot — gestión de clientes', icon: <Users className="w-5 h-5" />, color: 'border-indigo-800 bg-indigo-950/20 text-indigo-300' },
  { id: 'bi', nombre: 'BI / Analytics', descripcion: 'Power BI, Tableau — dashboards de gestión', icon: <BarChart3 className="w-5 h-5" />, color: 'border-amber-800 bg-amber-950/20 text-amber-300' },
  { id: 'rpa', nombre: 'RPA', descripcion: 'UiPath, Blue Prism — automatización robótica', icon: <Bot className="w-5 h-5" />, color: 'border-purple-800 bg-purple-950/20 text-purple-300' },
  { id: 'workflow', nombre: 'Workflow / BPM', descripcion: 'Pega, Camunda — orquestación de procesos', icon: <Zap className="w-5 h-5" />, color: 'border-emerald-800 bg-emerald-950/20 text-emerald-300' },
  { id: 'portal', nombre: 'Portal / Intranet', descripcion: 'SharePoint, Portal interno — colaboración', icon: <Globe className="w-5 h-5" />, color: 'border-slate-700 bg-slate-800/40 text-slate-300' },
]

function fecha(s: string) {
  return new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ProcesoImplCard({ proceso }: { proceso: ProcesoAprobado }) {
  const [sistemaSeleccionado, setSistemaSeleccionado] = useState<string | null>(null)
  const [notificado, setNotificado] = useState(false)

  async function notificarEquipo(sistemaId: string) {
    setSistemaSeleccionado(sistemaId)
    // En el futuro esto puede disparar un evento Inngest o notificación
    await new Promise(r => setTimeout(r, 600))
    setNotificado(true)
    toast.success(`Solicitud enviada al equipo para implementar en ${SISTEMAS_IMPL.find(s => s.id === sistemaId)?.nombre}`)
  }

  const total = proceso.total_en_macroproceso
  const num = proceso.numero_en_macroproceso

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                <CheckCircle2 className="w-3 h-3" /> Aprobado
              </span>
              {num != null && total != null && (
                <span className="text-xs text-indigo-400 bg-indigo-900/20 border border-indigo-900 px-2 py-0.5 rounded-full shrink-0">
                  Proceso {num} de {total}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-slate-100 mt-1">{proceso.nombre_proceso}</h3>
            {proceso.macroproceso && <p className="text-sm text-slate-500 mt-0.5">{proceso.macroproceso}</p>}
          </div>
          {proceso.aprobado_at && (
            <p className="text-xs text-slate-600 shrink-0">{fecha(proceso.aprobado_at)}</p>
          )}
        </div>
        {proceso.valor_negocio && (
          <p className="text-sm text-slate-400 mt-3 border-t border-slate-800 pt-3">{proceso.valor_negocio}</p>
        )}
      </div>

      {/* Zona implementación */}
      <div className="px-5 py-4">
        {notificado ? (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            Solicitud enviada — el equipo coordinará la implementación en {SISTEMAS_IMPL.find(s => s.id === sistemaSeleccionado)?.nombre}
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-slate-400 mb-3">¿En qué sistema se implementa este proceso?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SISTEMAS_IMPL.map(s => (
                <button
                  key={s.id}
                  onClick={() => notificarEquipo(s.id)}
                  className={`text-left border rounded-xl p-3 transition-all hover:opacity-90 ${s.color}`}
                >
                  <div className="mb-1">{s.icon}</div>
                  <p className="text-xs font-semibold">{s.nombre}</p>
                  <p className="text-[10px] opacity-70 mt-0.5 leading-tight">{s.descripcion}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ZonaImplementacion({ proyectos, procesosAprobados, nombreUsuario }: {
  proyectos: Proyecto[]
  procesosAprobados: ProcesoAprobado[]
  nombreUsuario: string
}) {
  const [proyectoFiltro, setProyectoFiltro] = useState<string>(proyectos[0]?.id ?? '')

  const procesosFiltrados = proyectoFiltro
    ? procesosAprobados.filter(p => p.proyecto_id === proyectoFiltro)
    : procesosAprobados

  const proyecto = proyectos.find(p => p.id === proyectoFiltro)

  // Contar cuántos procesos ya están en el macroproceso del primer proceso
  const totalEsperados = procesosFiltrados[0]?.total_en_macroproceso ?? null
  const aprobados = procesosFiltrados.length

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Zona de Implementación</h1>
        <p className="text-slate-400 text-sm mt-1">
          Procesos aprobados listos para implementar en tu organización
        </p>
      </div>

      {/* Selector proyecto */}
      {proyectos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {proyectos.map(p => (
            <button
              key={p.id}
              onClick={() => setProyectoFiltro(p.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border
                ${proyectoFiltro === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'}`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Progreso */}
      {totalEsperados != null && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-300">Progreso del inventario de procesos</p>
            <span className="text-sm font-bold text-indigo-400">{aprobados} / {totalEsperados} aprobados</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${Math.round((aprobados / totalEsperados) * 100)}%` }}
            />
          </div>
          {aprobados < totalEsperados && (
            <p className="text-xs text-slate-500 mt-3">
              Faltan {totalEsperados - aprobados} proceso(s) por revisar y aprobar
            </p>
          )}
          {aprobados >= totalEsperados && (
            <p className="text-xs text-emerald-400 mt-3 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Todos los procesos del inventario están aprobados
            </p>
          )}
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          href="/portal"
          className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-4 rounded-xl transition-colors"
        >
          <Upload className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Cargar siguiente proceso</p>
            <p className="text-xs text-indigo-200 mt-0.5">Volver al portal y subir otro documento</p>
          </div>
          <ArrowRight className="w-4 h-4 ml-auto shrink-0" />
        </Link>
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 text-slate-300 px-5 py-4 rounded-xl">
          <BarChart3 className="w-5 h-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-sm">{aprobados} proceso{aprobados !== 1 ? 's' : ''} aprobado{aprobados !== 1 ? 's' : ''}</p>
            <p className="text-xs text-slate-500 mt-0.5">Listos para implementar</p>
          </div>
        </div>
      </div>

      {/* Lista de procesos aprobados */}
      {procesosFiltrados.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <CheckCircle2 className="w-12 h-12 text-slate-700 mx-auto" />
          <p className="text-slate-400 font-medium">Aún no hay procesos aprobados</p>
          <p className="text-slate-500 text-sm">Ve al portal, sube un documento y aprueba el análisis para verlo aquí.</p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors mt-2"
          >
            Ir al portal <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-200">Procesos listos para implementar</h2>
          {procesosFiltrados.map(p => (
            <ProcesoImplCard key={p.id} proceso={p} />
          ))}
        </div>
      )}
    </div>
  )
}
