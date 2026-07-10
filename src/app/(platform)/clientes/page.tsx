import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import ClientesLista from '@/components/clientes/ClientesLista'

export const dynamic = 'force-dynamic'

const ROLES_INTERNOS = ['super_admin', 'director_proyecto', 'consultor']

export default async function ClientesPage() {
  // Protección de ruta — solo roles internos
  const supabaseAuth = createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/login')
  const { data: usuario } = await supabaseAuth.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario || !ROLES_INTERNOS.includes(usuario.rol)) redirect('/portal')

  const supabase = createAdminClient()
  const { data: clientes } = await supabase
    .from('cliente')
    .select('id, razon_social, industria, tamano, madurez_digital, proyecto(id, nombre, estado_general)')
    .eq('activo', true)
    .order('razon_social')
    .limit(100)

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

      <ClientesLista clientes={(clientes ?? []) as any} />
    </div>
  )
}
