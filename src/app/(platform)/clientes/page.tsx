import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import ClientesLista, { type ClienteRow } from '@/components/clientes/ClientesLista'

const ROLES_INTERNOS = ['super_admin', 'director_proyecto', 'consultor']
const PAGE_SIZE = 25

export default async function ClientesPage({ searchParams }: { searchParams: { page?: string } }) {
  // Protección de ruta — solo roles internos
  const supabaseAuth = createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/login')
  const { data: usuario } = await supabaseAuth.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !ROLES_INTERNOS.includes(usuario.rol)) redirect('/portal')

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = createAdminClient()
  const { data: clientes, count: totalClientes } = await supabase
    .from('cliente')
    .select('id, razon_social, industria, tamano, madurez_digital, proyecto(id, nombre, estado_general)', { count: 'exact' })
    .eq('activo', true)
    .order('razon_social')
    .range(from, to)
  const totalPaginas = Math.max(1, Math.ceil((totalClientes ?? 0) / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes e Industrias</h1>
          <p className="text-slate-400 text-sm mt-1">Vista 360° por cliente e industria</p>
        </div>
        <Link href="/clientes/nuevo">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="w-4 h-4" />
            Nuevo cliente
          </Button>
        </Link>
      </div>

      <ClientesLista clientes={(clientes ?? []) as unknown as ClienteRow[]} />

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">Página {page} de {totalPaginas} · {totalClientes} cliente{totalClientes !== 1 ? 's' : ''} en total</p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={`/clientes?page=${page - 1}`} className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors">← Anterior</Link>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">← Anterior</span>
            )}
            {page < totalPaginas ? (
              <Link href={`/clientes?page=${page + 1}`} className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors">Siguiente →</Link>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">Siguiente →</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
