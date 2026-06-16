import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ClienteForm from '@/components/clientes/ClienteForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EditarClientePage({ params }: { params: { id: string } }) {
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
