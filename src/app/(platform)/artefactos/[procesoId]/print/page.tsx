import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { LABEL_ARTEFACTO, ORDEN_GENERACION } from '@/lib/artefactos-meta'
import type { Artefacto, TipoArtefacto } from '@/types/database'
import PrintButton from './PrintButton'

interface Props { params: { procesoId: string } }

export default async function PrintPage({ params }: Props) {
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('*, proyecto(nombre, cliente(razon_social))')
    .eq('id', params.procesoId)
    .single()

  if (!proceso) notFound()

  const { data: artefactosRaw } = await admin
    .from('artefacto')
    .select('*')
    .eq('proceso_id', params.procesoId)
    .eq('estado_validacion', 'publicado')

  const artefactos = (artefactosRaw ?? []) as Artefacto[]
  const porTipo = artefactos.reduce((acc, a) => { acc[a.tipo] = a; return acc }, {} as Record<string, Artefacto>)

  const proyecto = proceso.proyecto as Record<string, unknown>
  const cliente = proyecto?.cliente as Record<string, unknown>
  const fechaHoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-page { padding: 0; }
          .artefacto-block { page-break-inside: avoid; }
        }
        @media screen {
          body { background: #0f172a; }
        }
      `}</style>

      <div className="print-page max-w-4xl mx-auto p-6 space-y-8">
        {/* Encabezado */}
        <div className="no-print mb-4">
          <PrintButton procesoNombre={proceso.nombre} />
        </div>

        <div className="border-b-2 border-slate-200 pb-6 space-y-1">
          <p className="text-xs text-slate-400 uppercase tracking-widest">ProcessOS — Reporte de Proceso</p>
          <h1 className="text-2xl font-bold text-slate-900">{proceso.nombre}</h1>
          <p className="text-slate-400 text-sm">{String(proyecto?.nombre ?? '')} · {String(cliente?.razon_social ?? '')}</p>
          <p className="text-slate-400 text-xs">Generado el {fechaHoy} · {artefactos.length} artefacto{artefactos.length !== 1 ? 's' : ''} publicados</p>
        </div>

        {ORDEN_GENERACION.map((tipo) => {
          const art = porTipo[tipo]
          if (!art) return null
          const label = LABEL_ARTEFACTO[tipo as TipoArtefacto]
          const c = art.contenido

          return (
            <div key={tipo} className="artefacto-block space-y-3">
              <h2 className="text-lg font-semibold text-slate-800 border-l-4 border-slate-400 pl-3">{label}</h2>
              <PrintArtefacto tipo={tipo as TipoArtefacto} c={c} />
            </div>
          )
        })}

        <div className="border-t border-slate-200 pt-4 text-center">
          <p className="text-slate-400 text-xs">Generado por ProcessOS · BY AICOUNTS CONSULTORES · {fechaHoy}</p>
        </div>
      </div>
    </>
  )
}

function PrintArtefacto({ tipo, c }: { tipo: TipoArtefacto; c: Record<string, unknown> }) {
  switch (tipo) {
    case 'sipoc': {
      const cols = [
        { key: 'proveedores', label: 'Proveedores' },
        { key: 'entradas', label: 'Entradas' },
        { key: 'proceso', label: 'Proceso' },
        { key: 'salidas', label: 'Salidas' },
        { key: 'clientes', label: 'Clientes' },
      ]
      return (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>{cols.map(col => <th key={col.key} className="border border-slate-300 bg-slate-100 p-2 text-left text-xs font-semibold text-slate-400">{col.label}</th>)}</tr>
          </thead>
          <tbody>
            <tr>{cols.map(col => {
              const v = c[col.key]
              return (
                <td key={col.key} className="border border-slate-300 p-2 align-top text-slate-400 text-xs">
                  {Array.isArray(v) ? v.map((i: unknown, j: number) => <div key={j}>· {String(i)}</div>) : String(v ?? '')}
                </td>
              )
            })}</tr>
          </tbody>
        </table>
      )
    }
    case 'acta_inicio': {
      const objetivos = (c.objetivos as Array<Record<string, unknown>>) ?? []
      return (
        <div className="text-sm text-slate-400 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 rounded p-2">
            <span><strong>Inicio:</strong> {String(c.fecha_inicio ?? '—')}</span>
            <span><strong>Fin est.:</strong> {String(c.fecha_fin_estimada ?? '—')}</span>
            <span><strong>Presupuesto:</strong> {String(c.presupuesto_estimado ?? '—')}</span>
          </div>
          {c.proposito ? <p><strong>Propósito:</strong> {String(c.proposito)}</p> : null}
          {objetivos.length > 0 && (
            <div>
              <strong>Objetivos:</strong>
              <ul className="mt-1 space-y-0.5 pl-4">
                {objetivos.map((o, i) => <li key={i} className="list-disc text-xs">{String(o.descripcion ?? '')} — Meta: {String(o.meta ?? '')}</li>)}
              </ul>
            </div>
          )}
          {(c.criterios_exito as string[] ?? []).length > 0 && (
            <div>
              <strong>Criterios de éxito:</strong>
              <ul className="mt-1 space-y-0.5 pl-4">{(c.criterios_exito as string[]).map((item, i) => <li key={i} className="list-disc text-xs">{item}</li>)}</ul>
            </div>
          )}
        </div>
      )
    }
    case 'roadmap': {
      const fases = (c.fases as Array<Record<string, unknown>>) ?? []
      return (
        <div className="text-sm text-slate-400 space-y-2">
          <p className="text-xs"><strong>Duración:</strong> {String(c.duracion_total_semanas ?? '—')} semanas · <strong>Metodología:</strong> {String(c.metodologia ?? '—')}</p>
          {fases.map((f, i) => (
            <div key={i} className="border-l-2 border-slate-300 pl-3">
              <p className="font-semibold text-xs">Fase {i+1}: {String(f.nombre ?? '')} (Sem {String(f.semana_inicio ?? '')}–{String(f.semana_fin ?? '')})</p>
              <p className="text-xs text-slate-400">{String(f.objetivo ?? '')}</p>
            </div>
          ))}
        </div>
      )
    }
    default: {
      return (
        <pre className="text-xs text-slate-400 bg-slate-50 rounded p-2 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(c, null, 2)}
        </pre>
      )
    }
  }
}
