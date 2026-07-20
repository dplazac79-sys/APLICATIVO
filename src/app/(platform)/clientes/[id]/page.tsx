import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Building2, FolderOpen, Pencil, ChevronRight,
  Network, Layers, FileText, BarChart3, ShieldAlert,
  TrendingUp, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import NuevoProyectoForm from '@/components/proyectos/NuevoProyectoForm'
import IntelIndustriaEditor from '@/components/clientes/IntelIndustriaEditor'
import type { Proyecto } from '@/types/database'

const TAMANO_LABELS: Record<string, string> = {
  micro: 'Micro', pequeña: 'Pequeña', mediana: 'Mediana', grande: 'Grande',
}

const NIVEL_RIESGO_STYLE: Record<string, string> = {
  critico: 'bg-red-950 text-red-400 border-red-800',
  alto:    'bg-orange-950 text-orange-400 border-orange-800',
  medio:   'bg-amber-950 text-amber-400 border-amber-800',
  bajo:    'bg-slate-800 text-slate-400 border-slate-700',
}

const ROLES_INTERNOS = ['super_admin', 'director_proyecto', 'consultor']

export default async function ClienteDetallePage({ params }: { params: { id: string } }) {
  // Esta página nunca chequeaba sesión ni rol — cualquier usuario autenticado
  // (incluyendo usuario_cliente de OTRO cliente) podía ver la ficha 360° de
  // cualquier cliente por id (razón social, RUT, facturación, KPIs, riesgos)
  // simplemente navegando /clientes/<id>. Mismo patrón de protección que
  // clientes/page.tsx (la lista) — hallazgo de auditoría profunda de frontend.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: usuarioAuth } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuarioAuth || !ROLES_INTERNOS.includes(usuarioAuth.rol)) redirect('/portal')

  const admin = createAdminClient()

  const { data: cliente } = await admin
    .from('cliente')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!cliente) notFound()

  const { data: proyectos } = await admin
    .from('proyecto')
    .select('*, proceso(id), artefacto(id)')
    .eq('cliente_id', params.id)
    .order('created_at', { ascending: false })

  const proyectoIds = (proyectos ?? []).map(p => p.id)

  const [
    { count: docCount },
    { data: kpis },
    { data: riesgos },
  ] = await Promise.all([
    admin.from('documento').select('id', { count: 'exact', head: true }).in('proyecto_id', proyectoIds),
    proyectoIds.length
      ? admin.from('kpi').select('id, nombre, linea_base, meta, frecuencia, proyecto_id').in('proyecto_id', proyectoIds).limit(6)
      : Promise.resolve({ data: [] }),
    proyectoIds.length
      ? admin.from('riesgo').select('id, descripcion, nivel_riesgo, proyecto_id').in('proyecto_id', proyectoIds).order('nivel_riesgo').limit(5)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{cliente.razon_social}</h1>
          <div className="flex items-center gap-2 mt-1">
            {cliente.industria && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-indigo-950 text-indigo-300 border-indigo-800">
                {cliente.industria}
              </span>
            )}
            {cliente.tamano && (
              <span className="text-xs text-slate-400">{TAMANO_LABELS[cliente.tamano] ?? cliente.tamano}</span>
            )}
          </div>
        </div>
        <Link
          href={`/clientes/${params.id}/editar`}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> Editar
        </Link>
      </div>

      {/* Ficha 360° */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Ficha 360°
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {cliente.rut && (
            <div><p className="text-slate-400 text-xs">RUT</p><p className="text-slate-200">{cliente.rut}</p></div>
          )}
          {cliente.dotacion && (
            <div><p className="text-slate-400 text-xs">Dotación</p><p className="text-slate-200">{cliente.dotacion.toLocaleString('es-CL')} personas</p></div>
          )}
          {cliente.madurez_digital && (
            <div><p className="text-slate-400 text-xs">Madurez digital</p><p className="text-slate-200 first-letter:capitalize">{cliente.madurez_digital}</p></div>
          )}
          {cliente.facturacion && (
            <div><p className="text-slate-400 text-xs">Facturación anual</p><p className="text-slate-200">USD {Number(cliente.facturacion).toLocaleString('es-CL')}</p></div>
          )}
          {cliente.objetivos_estrategicos && (
            <div className="col-span-2">
              <p className="text-slate-400 text-xs">Objetivos estratégicos</p>
              <p className="text-slate-200">{cliente.objetivos_estrategicos}</p>
            </div>
          )}
          {cliente.riesgos_declarados && (
            <div className="col-span-2">
              <p className="text-slate-400 text-xs">Riesgos declarados por el cliente</p>
              <p className="text-slate-200">{cliente.riesgos_declarados}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inteligencia de industria */}
      <IntelIndustriaEditor clienteId={params.id} inicial={cliente.inteligencia_industria as Record<string, unknown> | null} industria={cliente.industria ?? null} />

      {/* KPIs resumen */}
      {(kpis ?? []).length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> KPIs del portafolio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(kpis ?? []).map(k => (
                <div key={k.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">{k.nombre}</p>
                  <div className="flex items-end gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Línea base</p>
                      <p className="text-slate-300 font-medium">{k.linea_base ?? '—'}</p>
                    </div>
                    <TrendingUp className="w-4 h-4 text-indigo-500 mb-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Meta</p>
                      <p className="text-emerald-400 font-medium">{k.meta ?? '—'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Frecuencia: {k.frecuencia}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Riesgos resumen */}
      {(riesgos ?? []).length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Riesgos identificados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(riesgos ?? []).map(r => (
              <div key={r.id} className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0">
                <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                  r.nivel_riesgo === 'critico' ? 'text-red-400' :
                  r.nivel_riesgo === 'alto' ? 'text-orange-400' :
                  r.nivel_riesgo === 'medio' ? 'text-amber-400' : 'text-slate-400'
                }`} />
                <p className="text-sm text-slate-300 flex-1">{r.descripcion}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${NIVEL_RIESGO_STYLE[r.nivel_riesgo] ?? NIVEL_RIESGO_STYLE.bajo}`}>
                  {r.nivel_riesgo}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Proyectos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Proyectos ({proyectos?.length ?? 0})
          </h2>
        </div>

        <NuevoProyectoForm clienteId={params.id} />

        {(proyectos ?? []).map((p: Proyecto & { proceso?: { id: string }[], artefacto?: { id: string }[] }) => (
          <Link key={p.id} href={`/proyectos/${p.id}`}>
            <Card className="bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800/50 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{p.nombre}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                        p.estado_general === 'activo'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {p.estado_general}
                      </span>
                    </div>
                    {p.alcance && <p className="text-slate-400 text-xs mt-0.5 truncate">{p.alcance}</p>}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Network className="w-3 h-3" /> {(p.proceso ?? []).length} procesos
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Layers className="w-3 h-3" /> {(p.artefacto ?? []).length} artefactos
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <FileText className="w-3 h-3" /> {docCount ?? 0} documentos
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 ml-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
