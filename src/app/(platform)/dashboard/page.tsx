export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, FileText, FolderOpen, Sparkles } from 'lucide-react'
import Link from 'next/link'
import FaseWorkflow from '@/components/fases/FaseWorkflow'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: usuario } = await supabase
    .from('usuario')
    .select('nombre, rol, usuario_proyecto(proyecto_id)')
    .eq('id', user!.id)
    .single()

  const admin = createAdminClient()

  const [
    { count: clientesCount },
    { count: proyectosCount },
    { count: documentosCount },
  ] = await Promise.all([
    supabase.from('cliente').select('*', { count: 'exact', head: true }),
    supabase.from('proyecto').select('*', { count: 'exact', head: true }),
    supabase.from('documento').select('*', { count: 'exact', head: true }),
  ])

  // Cargar proyecto activo para workflow de fases
  const proyectoIds = (usuario?.usuario_proyecto ?? []).map((up: { proyecto_id: string }) => up.proyecto_id)
  let proyecto = null
  let fases = null

  if (proyectoIds.length > 0) {
    const { data: p } = await admin
      .from('proyecto')
      .select('id, nombre, estado_general, cliente:cliente_id(razon_social)')
      .in('id', proyectoIds)
      .eq('estado_general', 'activo')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    proyecto = p

    if (proyecto) {
      const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
      try {
        const res = await fetch(`${appUrl}/api/proyectos/${proyecto.id}/fases`, {
          cache: 'no-store',
        })
        if (res.ok) fases = (await res.json()).fases
      } catch { /* continuar sin fases */ }
    }
  }

  const stats = [
    { label: 'Clientes', value: clientesCount ?? 0, icon: Building2, color: 'text-indigo-400', bg: 'bg-indigo-950/50' },
    { label: 'Proyectos activos', value: proyectosCount ?? 0, icon: FolderOpen, color: 'text-emerald-400', bg: 'bg-emerald-950/50' },
    { label: 'Documentos', value: documentosCount ?? 0, icon: FileText, color: 'text-amber-400', bg: 'bg-amber-950/50' },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Bienvenido, {usuario?.nombre}
          </p>
        </div>
        <Link
          href="/bienvenida"
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" /> Ver pantalla de bienvenida
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">{stat.label}</p>
                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Workflow de fases */}
      {proyecto && fases ? (
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Progreso metodológico — {proyecto.nombre}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FaseWorkflow fases={fases} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-8 text-center">
            <p className="text-slate-500 text-sm">
              Sin proyecto activo asignado.{' '}
              {usuario?.rol === 'super_admin' && (
                <Link href="/admin/onboarding" className="text-indigo-400 hover:underline">
                  Crear cliente y proyecto
                </Link>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
