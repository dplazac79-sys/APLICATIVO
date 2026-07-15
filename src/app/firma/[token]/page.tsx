import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import FirmaForm from './FirmaForm'

export const dynamic = 'force-dynamic'

interface Props { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const admin = createAdminClient()
  const { data: firma } = await admin
    .from('firma_solicitud')
    .select('titulo')
    .eq('token', params.token)
    .single()

  return {
    title: firma?.titulo ? `Firmar: ${firma.titulo} — ProcessOS` : 'Solicitud de firma — ProcessOS',
    description: 'Firma digital de documento de consultoría.',
  }
}

export default async function FirmaPage({ params }: Props) {
  const admin = createAdminClient()
  const { data: firma } = await admin
    .from('firma_solicitud')
    .select('*')
    .eq('token', params.token)
    .single()

  if (!firma) notFound()

  const expirada = new Date(firma.expira_at) < new Date()

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-white font-bold text-xl tracking-tight">ProcessOS</p>
          <p className="text-slate-400 text-xs mt-1">BY AICOUNTS CONSULTORES</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Solicitud de firma digital</p>
            <h1 className="text-white text-lg font-medium">{firma.titulo}</h1>
            {firma.descripcion && (
              <p className="text-slate-400 text-sm mt-1">{firma.descripcion}</p>
            )}
          </div>

          {firma.estado === 'firmado' && (
            <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-4 text-center">
              <p className="text-emerald-400 font-medium">Documento firmado</p>
              <p className="text-slate-400 text-sm mt-1">
                Firmado por {firma.firmante_nombre ?? 'N/A'} el{' '}
                {firma.firmado_at ? new Date(firma.firmado_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          )}

          {firma.estado === 'rechazado' && (
            <div className="bg-red-950/30 border border-red-700/40 rounded-xl p-4 text-center">
              <p className="text-red-400 font-medium">Solicitud rechazada</p>
            </div>
          )}

          {(expirada || firma.estado === 'expirado') && firma.estado !== 'firmado' && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-slate-400 font-medium">Enlace expirado</p>
              <p className="text-slate-400 text-sm mt-1">Solicita un nuevo enlace al equipo consultor.</p>
            </div>
          )}

          {firma.estado === 'pendiente' && !expirada && (
            <FirmaForm
              token={params.token}
              firmaId={firma.id}
              firmante_nombre={firma.firmante_nombre ?? ''}
              firmante_cargo={firma.firmante_cargo ?? ''}
            />
          )}

          <p className="text-slate-400 text-xs text-center">
            Expira: {new Date(firma.expira_at).toLocaleDateString('es-CL')}
          </p>
        </div>
      </div>
    </div>
  )
}
