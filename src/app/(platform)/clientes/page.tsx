import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Plus, ChevronRight } from 'lucide-react'

const MADUREZ_COLOR: Record<string, string> = {
  inicial: 'bg-red-950 text-red-400 border-red-800',
  'en desarrollo': 'bg-amber-950 text-amber-400 border-amber-800',
  avanzado: 'bg-emerald-950 text-emerald-400 border-emerald-800',
}

export default async function ClientesPage() {
  const supabase = createClient()
  const { data: clientes } = await supabase
    .from('cliente')
    .select('*, proyecto(id, nombre, estado_general)')
    .eq('activo', true)
    .order('razon_social')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes e Industrias</h1>
          <p className="text-slate-400 text-sm mt-1">M1 — Vista 360° por cliente</p>
        </div>
        <Link href="/clientes/nuevo">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="w-4 h-4" />
            Nuevo cliente
          </Button>
        </Link>
      </div>

      {clientes?.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-16 text-center">
            <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">No hay clientes registrados aún.</p>
            <Link href="/clientes/nuevo">
              <Button variant="outline" className="mt-4 border-slate-700 text-slate-300 hover:bg-slate-800">
                Crear primer cliente
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {clientes?.map(cliente => {
          const proyectosActivos = cliente.proyecto?.filter(
            (p: { estado_general: string }) => p.estado_general === 'activo'
          ).length ?? 0

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
                            {cliente.madurez_digital}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {cliente.industria && (
                          <span className="text-sm text-slate-400">{cliente.industria}</span>
                        )}
                        {cliente.tamano && (
                          <span className="text-sm text-slate-600">· {cliente.tamano}</span>
                        )}
                        <span className="text-sm text-slate-600">
                          · {proyectosActivos} proyecto{proyectosActivos !== 1 ? 's' : ''} activo{proyectosActivos !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
