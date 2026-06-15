import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, FileText, FolderOpen, Activity } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: usuario } = await supabase
    .from('usuario')
    .select('*, usuario_proyecto(proyecto_id)')
    .eq('id', user!.id)
    .single()

  const isSuperAdmin = usuario?.rol === 'super_admin'

  const [
    { count: clientesCount },
    { count: proyectosCount },
    { count: documentosCount },
  ] = await Promise.all([
    supabase.from('cliente').select('*', { count: 'exact', head: true }),
    supabase.from('proyecto').select('*', { count: 'exact', head: true }),
    supabase.from('documento').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    {
      label: 'Clientes',
      value: clientesCount ?? 0,
      icon: Building2,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/50',
    },
    {
      label: 'Proyectos activos',
      value: proyectosCount ?? 0,
      icon: FolderOpen,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/50',
    },
    {
      label: 'Documentos',
      value: documentosCount ?? 0,
      icon: FileText,
      color: 'text-amber-400',
      bg: 'bg-amber-950/50',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Bienvenido, {usuario?.nombre}
        </p>
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

      {/* Estado de construcción */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Estado de construcción — Roadmap APIP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { fase: 1, nombre: 'Fundación', estado: 'en_curso', modulos: 'M1, M2, RBAC, M8 shell' },
              { fase: 2, nombre: 'IA de Descubrimiento', estado: 'pendiente', modulos: 'M2 completo, M3' },
              { fase: 3, nombre: 'Artefactos Inteligentes', estado: 'pendiente', modulos: 'M4, M5' },
              { fase: 4, nombre: 'Gestión de Proyecto', estado: 'pendiente', modulos: 'M7, M8' },
              { fase: 5, nombre: 'Simulación de Impacto', estado: 'pendiente', modulos: 'M6' },
              { fase: 6, nombre: 'Automation Studio', estado: 'pendiente', modulos: 'M9, M10, Analytics' },
            ].map(f => (
              <div key={f.fase} className="flex items-center gap-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  f.estado === 'completado'
                    ? 'bg-emerald-600 text-white'
                    : f.estado === 'en_curso'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  {f.fase}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${f.estado === 'en_curso' ? 'text-white' : 'text-slate-400'}`}>
                      Fase {f.fase} — {f.nombre}
                    </span>
                    {f.estado === 'en_curso' && (
                      <span className="text-xs bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-full">
                        En curso
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{f.modulos}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
