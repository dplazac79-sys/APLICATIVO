import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { errorResponse } from '@/lib/api/error-response'

// Mismas 5 reglas que el resto de la plataforma (cambiar-password) — el
// formulario de onboarding solo mostraba un hint de texto "mínimo 6
// caracteres" sin validar nada, ni en el cliente ni acá, así que se podían
// crear cuentas reales del portal cliente con contraseñas de 1 carácter.
function cumpleRequisitos(pwd: string): boolean {
  return typeof pwd === 'string' && pwd.length >= 8
    && /[A-Z]/.test(pwd)
    && /[a-z]/.test(pwd)
    && /[0-9]/.test(pwd)
    && /[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>/?]/.test(pwd)
}

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

    if (proyecto.fecha_inicio && proyecto.fecha_estimada_cierre && proyecto.fecha_estimada_cierre < proyecto.fecha_inicio) {
      return NextResponse.json({ error: 'La fecha estimada de cierre no puede ser anterior a la fecha de inicio' }, { status: 400 })
    }

    const admin = createAdminClient()

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
      return errorResponse(errCliente ?? new Error('cliente no creado'), 500, 'No se pudo crear el cliente.')
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
      return errorResponse(errProyecto ?? new Error('proyecto no creado'), 500, 'No se pudo crear el proyecto.')
    }

    // 3. Invitar usuarios del equipo
    const resultadosEquipo: Array<{ email: string; status: string; error?: string }> = []

    for (const miembro of equipo) {
      if (!miembro.email) continue
      if (!cumpleRequisitos(miembro.password)) {
        resultadosEquipo.push({ email: miembro.email, status: 'error', error: 'La contraseña no cumple los requisitos de seguridad (mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial).' })
        continue
      }
      try {
        // Crear usuario con contraseña directamente
        const { data: creado, error: errCreate } = await admin.auth.admin.createUser({
          email: miembro.email,
          password: miembro.password,
          email_confirm: true,
          user_metadata: { full_name: miembro.nombre, must_change_password: true },
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
            if (miembro.rol !== 'super_admin') {
              await admin.from('usuario_proyecto').upsert(
                { usuario_id: usuarioExistente.id, proyecto_id: proyectoCreado.id },
                { onConflict: 'usuario_id,proyecto_id' }
              )
            }
            resultadosEquipo.push({ email: miembro.email, status: 'rol_actualizado' })
          } else {
            console.error(`[onboarding] Falló crear usuario ${miembro.email}:`, errCreate?.message)
            resultadosEquipo.push({ email: miembro.email, status: 'error', error: 'No se pudo crear la cuenta del usuario.' })
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

        // Vincular al proyecto recién creado — sin esta fila, las políticas RLS
        // le bloquean el acceso al proyecto (super_admin queda exento por su rol
        // global, así que no necesita esta fila, pero el resto de roles sí).
        if (miembro.rol !== 'super_admin') {
          await admin.from('usuario_proyecto').upsert(
            { usuario_id: creado.user.id, proyecto_id: proyectoCreado.id },
            { onConflict: 'usuario_id,proyecto_id' }
          )
        }

        await registrarAudit({
          accion: 'CREATE',
          entidad: 'usuario',
          entidad_id: creado.user.id,
          detalle: { nombre: miembro.nombre, email: miembro.email, rol: miembro.rol },
          usuarioId: user.id,
        })
        resultadosEquipo.push({ email: miembro.email, status: 'creado' })
      } catch (e) {
        console.error(`[onboarding] Error inesperado creando usuario ${miembro.email}:`, e instanceof Error ? e.message : String(e))
        resultadosEquipo.push({ email: miembro.email, status: 'error', error: 'Error inesperado creando la cuenta del usuario.' })
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

    // Cliente y proyecto ya quedaron creados en este punto — no hay rollback
    // de eso porque revertirlos podría destruir un proyecto real si algún
    // miembro del equipo falla por una razón menor. Pero si NINGÚN miembro
    // terminó con acceso real (creado o rol_actualizado), hay que decirlo
    // explícitamente: antes esto respondía ok:true igual, dejando un
    // proyecto sin nadie que pueda entrar a verlo, con el error escondido
    // dentro del array `equipo` que la UI no siempre revisa a fondo.
    const algunAccesoOtorgado = resultadosEquipo.some(r => r.status === 'creado' || r.status === 'rol_actualizado')
    const huboErrores = resultadosEquipo.some(r => r.status === 'error')

    return NextResponse.json({
      ok: true,
      advertencia: !algunAccesoOtorgado && equipo.some(m => m.email)
        ? 'Se creó el cliente y el proyecto, pero ningún miembro del equipo quedó con acceso — revisa los errores y agrega usuarios manualmente.'
        : huboErrores
          ? 'Se creó el cliente y el proyecto, pero algunos miembros del equipo no se pudieron crear — revisa el detalle.'
          : undefined,
      cliente_id: clienteCreado.id,
      proyecto_id: proyectoCreado.id,
      equipo: resultadosEquipo,
    })
  } catch (err) {
    return errorResponse(err, 500)
  }
}
