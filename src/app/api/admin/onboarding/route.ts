import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: yo } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
    if (yo?.rol !== 'super_admin') return NextResponse.json({ error: 'Solo super_admin puede usar onboarding' }, { status: 403 })

    const body = await req.json()
    const { empresa, proyecto, equipo } = body as {
      empresa: {
        razon_social: string
        industria: string
        tamano: string
        objetivos_estrategicos: string
      }
      proyecto: {
        nombre: string
        descripcion: string
        fecha_inicio: string
        fecha_estimada_cierre: string
      }
      equipo: Array<{ email: string; nombre: string; rol: string }>
    }

    const admin = createAdminClient()
    const appUrl = process.env.APP_URL ?? 'https://aplicativo-production.up.railway.app'

    // 1. Crear cliente
    const { data: clienteCreado, error: errCliente } = await admin
      .from('cliente')
      .insert({
        razon_social: empresa.razon_social,
        industria: empresa.industria,
        tamano: empresa.tamano,
        objetivos_estrategicos: empresa.objetivos_estrategicos,
        activo: true,
      })
      .select()
      .single()

    if (errCliente || !clienteCreado) {
      return NextResponse.json({ error: 'Error creando cliente: ' + errCliente?.message }, { status: 500 })
    }

    // 2. Crear proyecto
    const { data: proyectoCreado, error: errProyecto } = await admin
      .from('proyecto')
      .insert({
        nombre: proyecto.nombre,
        cliente_id: clienteCreado.id,
        estado_general: 'activo',
      })
      .select()
      .single()

    if (errProyecto || !proyectoCreado) {
      return NextResponse.json({ error: 'Error creando proyecto: ' + errProyecto?.message }, { status: 500 })
    }

    // 3. Invitar usuarios del equipo
    const resultadosEquipo: Array<{ email: string; status: string; error?: string }> = []

    for (const miembro of equipo) {
      if (!miembro.email) continue
      try {
        // Invitar vía Supabase Auth (envía email de invitación)
        const { data: invitado, error: errInvite } = await admin.auth.admin.inviteUserByEmail(
          miembro.email,
          {
            redirectTo: `${appUrl}/login`,
            data: { full_name: miembro.nombre },
          }
        )

        if (errInvite || !invitado?.user) {
          // Si ya existe el usuario, buscarlo
          const { data: usuarioExistente } = await admin
            .from('usuario')
            .select('id')
            .eq('email', miembro.email)
            .single()

          if (usuarioExistente) {
            // Actualizar rol si el usuario ya existe
            await admin.from('usuario').update({ rol: miembro.rol as never }).eq('id', usuarioExistente.id)
            resultadosEquipo.push({ email: miembro.email, status: 'rol_actualizado' })
          } else {
            resultadosEquipo.push({ email: miembro.email, status: 'error', error: errInvite?.message })
          }
          continue
        }

        // Crear registro en tabla usuario
        await admin.from('usuario').upsert({
          id: invitado.user.id,
          email: miembro.email,
          nombre: miembro.nombre || miembro.email.split('@')[0],
          rol: miembro.rol as never,
          activo: true,
        })

        resultadosEquipo.push({ email: miembro.email, status: 'invitado' })
      } catch (e) {
        resultadosEquipo.push({ email: miembro.email, status: 'error', error: String(e) })
      }
    }

    return NextResponse.json({
      ok: true,
      cliente_id: clienteCreado.id,
      proyecto_id: proyectoCreado.id,
      equipo: resultadosEquipo,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
