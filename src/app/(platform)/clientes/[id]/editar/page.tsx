import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import ClienteForm from '@/components/clientes/ClienteForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Solo super_admin puede editar clientes (mismo permiso que crear, ver
// clientes/route.ts POST) — página sin ningún chequeo antes, cualquier
// usuario autenticado podía llegar al formulario de edición de cualquier
// cliente. Hallazgo de auditoría profunda de frontend.
export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: usuarioAuth } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (usuarioAuth?.rol !== 'super_admin') redirect('/portal')

  const admin = createAdminClient()

  const { data: cliente } = await admin
    .from('cliente')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!cliente) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/clientes/${params.id}`}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Editar cliente</h1>
          <p className="text-slate-400 text-sm mt-0.5">{cliente.razon_social}</p>
        </div>
      </div>

      <ClienteForm cliente={cliente} />
    </div>
  )
}
