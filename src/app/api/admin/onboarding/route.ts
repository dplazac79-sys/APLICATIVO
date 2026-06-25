import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

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
        contexto: string
        objetivos: string
        alcance_incluye: string
        alcance_excluye: string
        n_procesos_estimados: string
        fecha_inicio: string
        fecha_estimada_cierre: string
      }
      equipo: Array<{ email: string; nombre: string; rol: string; password: string }>
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
        descripcion: proyecto.descripcion || null,
        contexto: proyecto.contexto || null,
        objetivos: proyecto.objetivos || null,
        alcance_incluye: proyecto.alcance_incluye || null,
        alcance_excluye: proyecto.alcance_excluye || null,
        n_procesos_estimados: proyecto.n_procesos_estimados ? parseInt(proyecto.n_procesos_estimados) : null,
        cliente_id: clienteCreado.id,
        fecha_inicio: proyecto.fecha_inicio || null,
        fecha_estimada_cierre: proyecto.fecha_estimada_cierre || null,
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
        // Crear usuario con contraseña directamente
        const { data: creado, error: errCreate } = await admin.auth.admin.createUser({
          email: miembro.email,
          password: miembro.password,
          email_confirm: true,
          user_metadata: { full_name: miembro.nombre },
        })

        if (errCreate || !creado?.user) {
          // Si ya existe, buscar y actualizar rol
          const { data: usuarioExistente } = await admin
            .from('usuario')
            .select('id')
            .eq('email', miembro.email)
            .single()

          if (usuarioExistente) {
            await admin.from('usuario').update({ rol: miembro.rol as never }).eq('id', usuarioExistente.id)
            resultadosEquipo.push({ email: miembro.email, status: 'rol_actualizado' })
          } else {
            resultadosEquipo.push({ email: miembro.email, status: 'error', error: errCreate?.message })
          }
          continue
        }

        // Crear registro en tabla usuario
        await admin.from('usuario').upsert({
          id: creado.user.id,
          email: miembro.email,
          nombre: miembro.nombre || miembro.email.split('@')[0],
          rol: miembro.rol as never,
          activo: true,
        })

        await registrarAudit({
          accion: 'CREATE',
          entidad: 'usuario',
          entidad_id: creado.user.id,
          detalle: { nombre: miembro.nombre, email: miembro.email, rol: miembro.rol },
          usuarioId: user.id,
        })
        resultadosEquipo.push({ email: miembro.email, status: 'creado' })
      } catch (e) {
        resultadosEquipo.push({ email: miembro.email, status: 'error', error: String(e) })
      }
    }

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'cliente',
      entidad_id: clienteCreado.id,
      detalle: { nombre: empresa.razon_social, industria: empresa.industria },
      usuarioId: user.id,
    })
    await registrarAudit({
      accion: 'CREATE',
      entidad: 'proyecto',
      entidad_id: proyectoCreado.id,
      detalle: { nombre: proyecto.nombre, cliente: empresa.razon_social },
      usuarioId: user.id,
    })

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
