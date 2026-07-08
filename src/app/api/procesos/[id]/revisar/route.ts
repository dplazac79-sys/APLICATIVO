import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createAdminClient()
    const { data: usuario } = await admin.from('usuario').select('rol').eq('id', user.id).single()
    const rolesAutorizados = ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente', 'usuario_cliente']
    if (!usuario || !rolesAutorizados.includes(usuario.rol)) {
      return NextResponse.json({ error: 'Solo Consultor, Director de Proyecto o Super Administrador pueden revisar propuestas de procesos' }, { status: 403 })
    }

    const { estado_oferta } = await req.json()
    if (!['aceptado', 'rechazado'].includes(estado_oferta)) {
      return NextResponse.json({ error: 'estado_oferta inválido' }, { status: 400 })
    }

    // Derive codigo from metadata_ia.documento_referencia if not already set
    const { data: procesoActual } = await admin
      .from('proceso')
      .select('codigo, metadata_ia')
      .eq('id', params.id)
      .single()

    const updates: Record<string, unknown> = { estado_oferta }
    if (!procesoActual?.codigo) {
      const docRef = (procesoActual?.metadata_ia as Record<string, unknown> | null)?.documento_referencia as string | null
      if (docRef) {
        updates.codigo = docRef.replace(/\.[^.]+$/, '').toUpperCase()
      }
    }

    const { data, error } = await admin
      .from('proceso')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await registrarAudit({
      accion: estado_oferta === 'aceptado' ? 'APPROVE' : 'UPDATE',
      entidad: 'proceso',
      entidad_id: params.id,
      detalle: { estado_oferta },
    })

    return NextResponse.json({ ok: true, proceso: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
