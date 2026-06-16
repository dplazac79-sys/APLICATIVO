import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, FolderOpen, Pencil } from 'lucide-react'
import Link from 'next/link'
import NuevoProyectoForm from '@/components/proyectos/NuevoProyectoForm'
import IntelIndustriaEditor from '@/components/clientes/IntelIndustriaEditor'
import type { Proyecto } from '@/types/database'

export const dynamic = 'force-dynamic'

const TAMANO_LABELS: Record<string, string> = {
  micro: 'Micro', pequeña: 'Pequeña', mediana: 'Mediana', grande: 'Grande',
}

export default async function ClienteDetallePage({ params }: { params: { id: string } }) {
  const admin = createAdminClient()

  const { data: cliente } = await admin
    .from('cliente')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!cliente) notFound()

  const { data: proyectos } = await admin
    .from('proyecto')
    .select('*')
    .eq('cliente_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-4xl">
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
            <span className="text-xs text-slate-500">{TAMANO_LABELS[cliente.tamano] ?? cliente.tamano}</span>
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

      {/* Info 360 */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Ficha 360°
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          {cliente.rut && (
            <div><p className="text-slate-500 text-xs">RUT</p><p className="text-slate-200">{cliente.rut}</p></div>
          )}
          {cliente.dotacion && (
            <div><p className="text-slate-500 text-xs">Dotación</p><p className="text-slate-200">{cliente.dotacion} personas</p></div>
          )}
          {cliente.madurez_digital && (
            <div><p className="text-slate-500 text-xs">Madurez digital</p><p className="text-slate-200 capitalize">{cliente.madurez_digital}</p></div>
          )}
          {cliente.objetivos_estrategicos && (
            <div className="col-span-2">
              <p className="text-slate-500 text-xs">Objetivos estratégicos</p>
              <p className="text-slate-200">{cliente.objetivos_estrategicos}</p>
            </div>
          )}
          {cliente.riesgos_declarados && (
            <div className="col-span-2">
              <p className="text-slate-500 text-xs">Riesgos declarados</p>
              <p className="text-slate-200">{cliente.riesgos_declarados}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <IntelIndustriaEditor clienteId={params.id} inicial={cliente.inteligencia_industria as Record<string, unknown> | null} />

      {/* Proyectos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Proyectos ({proyectos?.length ?? 0})
          </h2>
        </div>

        <NuevoProyectoForm clienteId={params.id} />

        {(proyectos ?? []).map((p: Proyecto) => (
          <Card key={p.id} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{p.nombre}</p>
                {p.alcance && <p className="text-slate-500 text-xs mt-0.5">{p.alcance}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                p.estado_general === 'activo'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {p.estado_general}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
