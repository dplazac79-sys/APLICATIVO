import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const { accion, firmante_nombre, firmante_cargo, token } = body

  if (!['firmar', 'rechazar'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: firma } = await admin
    .from('firma_solicitud')
    .select('*')
    .eq('id', params.id)
    .eq('token', token)
    .single()

  if (!firma) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (firma.estado !== 'pendiente') return NextResponse.json({ error: 'Solicitud ya procesada' }, { status: 409 })
  if (new Date(firma.expira_at) < new Date()) {
    await admin.from('firma_solicitud').update({ estado: 'expirado' }).eq('id', params.id)
    return NextResponse.json({ error: 'Enlace expirado' }, { status: 410 })
  }

  const headersList = headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] ?? headersList.get('x-real-ip') ?? null

  const { data, error } = await admin
    .from('firma_solicitud')
    .update({
      estado: accion === 'firmar' ? 'firmado' : 'rechazado',
      firmante_nombre: firmante_nombre || firma.firmante_nombre,
      firmante_cargo: firmante_cargo || firma.firmante_cargo,
      firmado_at: accion === 'firmar' ? new Date().toISOString() : null,
      ip_firma: ip,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return jsonError(error)
  return NextResponse.json(data)
}
