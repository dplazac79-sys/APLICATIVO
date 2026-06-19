export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import FaseWorkflow from '@/components/fases/FaseWorkflow'
import { getFasesProyecto } from '@/lib/fases'

export default async function BienvenidaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuario')
    .select('nombre, rol, usuario_proyecto(proyecto_id)')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()
  const proyectoIds = (usuario?.usuario_proyecto ?? []).map((up: { proyecto_id: string }) => up.proyecto_id)

  let proyectoMeta = null
  let fases = null

  if (proyectoIds.length > 0) {
    const { data: p } = await admin
      .from('proyecto')
      .select('id, nombre, estado_general, cliente:cliente_id(razon_social, industria)')
      .in('id', proyectoIds)
      .eq('estado_general', 'activo')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (p) {
      proyectoMeta = p
      const result = await getFasesProyecto(p.id)
      fases = result.fases
    }
  }

  const nombre = usuario?.nombre?.split(' ')[0] ?? 'Equipo'
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const cliente = proyectoMeta?.cliente as { razon_social?: string } | null

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/20 rounded-2xl p-8">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-indigo-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-violet-500 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span className="text-xs text-indigo-300 font-medium uppercase tracking-widest">APAC — Aplicativo Consultivo</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                {saludo}, <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">{nombre}</span>
              </h1>
              {proyectoMeta ? (
                <p className="text-slate-400 mt-2 text-base">
                  Proyecto activo: <span className="text-slate-200 font-medium">{proyectoMeta.nombre}</span>
                  {cliente?.razon_social && (
                    <> · <span className="text-slate-300">{cliente.razon_social}</span></>
                  )}
                </p>
              ) : (
                <p className="text-slate-400 mt-2">No hay proyectos activos asignados aún.</p>
              )}
            </div>

            {proyectoMeta && (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shrink-0"
              >
                Ir al dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {proyectoMeta && fases && (
            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-800">
              {[
                {
                  label: 'Fase actual',
                  value: `F${fases.find(f => f.status === 'activa')?.id ?? '—'}`,
                  sub: fases.find(f => f.status === 'activa')?.nombre ?? 'Sin fase activa',
                },
                {
                  label: 'Completadas',
                  value: `${fases.filter(f => f.status === 'completada').length}/${fases.length}`,
                  sub: 'fases del proyecto',
                },
                {
                  label: 'Progreso global',
                  value: `${Math.round((fases.filter(f => f.status === 'completada').length / fases.length) * 100)}%`,
                  sub: 'de avance metodológico',
                },
              ].map(m => (
                <div key={m.label}>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">{m.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{m.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.sub}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {proyectoMeta && fases ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Workflow de fases</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Avanza fase por fase. Las fases se desbloquean al completar los requisitos de la anterior.
            </p>
          </div>
          <FaseWorkflow fases={fases} />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-indigo-950 rounded-2xl flex items-center justify-center mx-auto text-2xl">🏗️</div>
          <div>
            <h3 className="text-white font-semibold">Sin proyecto asignado</h3>
            <p className="text-slate-400 text-sm mt-1">Un administrador debe crear un proyecto y asignarte a él para comenzar.</p>
          </div>
          {usuario?.rol === 'super_admin' && (
            <Link
              href="/admin/onboarding"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              Crear primer cliente y proyecto <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
