export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { FolderOpen, Bell } from 'lucide-react'
import {
  SeccionDocumentos,
  SeccionEntregables,
  SeccionTimeline,
  VerDocumentosLink,
  type ArtefactoItem,
  type EntregableItem,
  type TimelineEvento,
} from './PortalInteractivo'

const ESTADO_PROYECTO_LABEL: Record<string, string> = {
  activo: 'En curso',
  pausado: 'En pausa',
  cerrado: 'Finalizado',
}

const ESTADO_PROYECTO_COLOR: Record<string, string> = {
  activo: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  pausado: 'bg-amber-900/40 text-amber-300 border-amber-800',
  cerrado: 'bg-slate-800 text-slate-400 border-slate-700',
}

const ARTEFACTO_LABEL: Record<string, string> = {
  as_is: 'Mapa del proceso actual',
  to_be: 'Proceso optimizado propuesto',
  raci: 'Matriz de responsabilidades',
  kpi_sla: 'Indicadores y niveles de servicio',
  dashboard_brechas: 'Análisis de brechas',
  bpmn: 'Diagrama del proceso',
}

export default async function PortalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuario')
    .select('nombre, rol')
    .eq('id', user.id)
    .single()

  // Solo para roles de cliente. Equipo interno va al dashboard.
  if (usuario && usuario.rol !== 'sponsor_cliente' && usuario.rol !== 'usuario_cliente') {
    redirect('/dashboard')
  }

  // Proyectos visibles para el cliente (RLS limita a los suyos).
  const { data: proyectos } = await supabase
    .from('proyecto')
    .select('id, nombre, estado_general, fase_actual, updated_at')
    .order('updated_at', { ascending: false })

  const proyectoIds = (proyectos ?? []).map(p => p.id)

  // Artefactos publicados + simulaciones exportadas + notificaciones (RLS los acota al cliente).
  const [{ data: artefactosRaw }, { data: entregablesRaw }, { data: notificaciones }] = await Promise.all([
    proyectoIds.length
      ? supabase
          .from('artefacto')
          .select('id, tipo, proceso_id, estado_validacion, updated_at')
          .eq('estado_validacion', 'publicado')
          .order('updated_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; tipo: string; estado_validacion: string; updated_at: string }> }),
    proyectoIds.length
      ? supabase
          .from('entregable')
          .select('id, nombre, tipo, estado, updated_at')
          .eq('tipo', 'simulacion')
          .eq('estado', 'exportado')
          .order('updated_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; nombre: string; tipo: string; estado: string; updated_at: string }> }),
    supabase
      .from('notificacion')
      .select('id, titulo, cuerpo, leida, created_at')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const artefactos: ArtefactoItem[] = (artefactosRaw ?? []).map(a => ({
    id: a.id,
    tipo: a.tipo,
    updated_at: a.updated_at,
  }))
  const entregables: EntregableItem[] = (entregablesRaw ?? []).map(e => ({
    id: e.id,
    nombre: e.nombre,
    tipo: e.tipo,
    updated_at: e.updated_at,
  }))

  const noLeidas = (notificaciones ?? []).filter(n => !n.leida).length
  const pendientesRevision = artefactos.length // artefactos publicados; el "aprobado por ti" se resuelve en cliente

  const fecha = (s: string) =>
    new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })

  // ── Línea de tiempo: combinar eventos ya cargados, sin queries adicionales ──
  const eventos: TimelineEvento[] = [
    ...artefactos.map<TimelineEvento>(a => ({
      id: `art-${a.id}`,
      fecha: a.updated_at,
      titulo: `Documento publicado: ${ARTEFACTO_LABEL[a.tipo] ?? a.tipo}`,
      detalle: 'Disponible para revisión en tu portal.',
      tipo: 'documento',
    })),
    ...entregables.map<TimelineEvento>(e => ({
      id: `ent-${e.id}`,
      fecha: e.updated_at,
      titulo: `Análisis compartido: ${e.nombre}`,
      detalle: 'Exportado por el equipo consultor.',
      tipo: 'entregable',
    })),
    ...(notificaciones ?? []).map<TimelineEvento>(n => ({
      id: `not-${n.id}`,
      fecha: n.created_at,
      titulo: n.titulo,
      detalle: n.cuerpo,
      tipo: 'notificacion',
    })),
  ]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 10)

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Hola, {usuario?.nombre ?? 'bienvenido'}</h1>
        <p className="text-slate-400 text-sm mt-1">
          Aquí puede seguir el avance de sus proyectos y acceder a los documentos y análisis disponibles.
        </p>
      </div>

      {/* Mis Proyectos */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-medium text-slate-200 mb-3">
          <FolderOpen className="w-5 h-5 text-indigo-400" /> Mis Proyectos
        </h2>
        {(!proyectos || proyectos.length === 0) ? (
          <p className="text-slate-500 text-sm">Aún no tiene proyectos asignados.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {proyectos.map(p => (
              <Card key={p.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-100">{p.nombre}</p>
                    <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${ESTADO_PROYECTO_COLOR[p.estado_general] ?? ESTADO_PROYECTO_COLOR.activo}`}>
                      {ESTADO_PROYECTO_LABEL[p.estado_general] ?? p.estado_general}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Etapa {p.fase_actual} de 6</p>
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.round((p.fase_actual / 6) * 100))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {pendientesRevision > 0 && (
                        <span className="text-[11px] text-emerald-400 bg-emerald-900/30 border border-emerald-800 px-1.5 py-0.5 rounded">
                          {pendientesRevision} doc. por revisar
                        </span>
                      )}
                      {noLeidas > 0 && (
                        <span className="text-[11px] text-indigo-300 bg-indigo-900/40 border border-indigo-800 px-1.5 py-0.5 rounded">
                          {noLeidas} sin leer
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    <VerDocumentosLink pendientes={pendientesRevision} />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2">Actualizado {fecha(p.updated_at)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Documentos disponibles (interactivo) */}
      <SeccionDocumentos artefactos={artefactos} />

      {/* Análisis de impacto (con descarga PDF) */}
      <SeccionEntregables entregables={entregables} />

      {/* Notificaciones */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-medium text-slate-200 mb-3">
          <Bell className="w-5 h-5 text-slate-400" /> Notificaciones
          {noLeidas > 0 && (
            <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">{noLeidas}</span>
          )}
        </h2>
        {(!notificaciones || notificaciones.length === 0) ? (
          <p className="text-slate-500 text-sm">No tiene notificaciones pendientes.</p>
        ) : (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0 divide-y divide-slate-800">
              {notificaciones.map(n => (
                <div key={n.id} className={`px-4 py-3 ${n.leida ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-200 font-medium">{n.titulo}</p>
                    {!n.leida && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{n.cuerpo}</p>
                  <p className="text-[11px] text-slate-600 mt-1">{fecha(n.created_at)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Línea de tiempo del proyecto */}
      <SeccionTimeline eventos={eventos} />
    </div>
  )
}
