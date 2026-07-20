import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { requireRole } from '@/lib/auth/tenant'
import { errorResponse } from '@/lib/api/error-response'
import type { RolTipo } from '@/types/database'

// Mismo enum que la columna rol_tipo en BD — validado también acá (defensa
// en profundidad) para devolver un error claro en vez de depender solo del
// rechazo silencioso del check constraint de Postgres.
const ROLES_VALIDOS: readonly RolTipo[] = [
  'super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente', 'usuario_cliente',
]

// Mismas 5 reglas del resto de la plataforma (cambiar-password, onboarding).
function cumpleRequisitos(pwd: string): boolean {
  return typeof pwd === 'string' && pwd.length >= 8
    && /[A-Z]/.test(pwd)
    && /[a-z]/.test(pwd)
    && /[0-9]/.test(pwd)
    && /[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>/?]/.test(pwd)
}

// POST: agrega a alguien al equipo de un proyecto ya existente — antes esto
// solo era posible al crear el proyecto desde el wizard de onboarding, sin
// forma de sumar gente después. Si el correo ya tiene cuenta en la
// plataforma, solo se vincula al proyecto (no se toca su rol global ni su
// contraseña). Si no existe, se crea una cuenta nueva con contraseña
// temporal — igual que en onboarding.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!(await requireRole(user.id, ['super_admin']))) {
    return NextResponse.json({ error: 'Solo super_admin puede gestionar el equipo de un proyecto' }, { status: 403 })
  }

  const { email, nombre, rol, password } = await req.json() as {
    email?: string; nombre?: string; rol?: string; password?: string
  }
  if (!email?.trim()) return NextResponse.json({ error: 'Falta el correo' }, { status: 400 })

  const admin = createAdminClient()

  const { data: proyecto } = await admin.from('proyecto').select('id').eq('id', params.id).single()
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const { data: existente } = await admin
    .from('usuario')
    .select('id, nombre')
    .eq('email', email.trim())
    .maybeSingle()

  let usuarioId: string

  if (existente) {
    usuarioId = existente.id
  } else {
    if (!nombre?.trim() || !rol?.trim()) {
      return NextResponse.json({ error: 'Falta nombre o rol para crear la cuenta nueva' }, { status: 400 })
    }
    if (!ROLES_VALIDOS.includes(rol as RolTipo)) {
      return NextResponse.json({ error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}` }, { status: 400 })
    }
    if (!password || !cumpleRequisitos(password)) {
      return NextResponse.json({ error: 'La contraseña temporal no cumple los requisitos de seguridad (mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial)' }, { status: 400 })
    }
    const { data: creado, error: errCreate } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: nombre, must_change_password: true },
    })
    if (errCreate || !creado?.user) {
      return errorResponse(errCreate ?? new Error('user not created'), 500, 'No se pudo crear la cuenta')
    }
    await admin.from('usuario').insert({
      id: creado.user.id,
      email: email.trim(),
      nombre: nombre.trim(),
      rol: rol as never,
      activo: true,
    })
    usuarioId = creado.user.id
  }

  const { error: errLink } = await admin
    .from('usuario_proyecto')
    .upsert({ usuario_id: usuarioId, proyecto_id: params.id }, { onConflict: 'usuario_id,proyecto_id' })

  if (errLink) return errorResponse(errLink, 500, 'No se pudo vincular al usuario al proyecto.')

  await registrarAudit({
    accion: 'CREATE',
    entidad: 'usuario_proyecto',
    entidad_id: `${params.id}:${usuarioId}`,
    detalle: { proyecto_id: params.id, usuario_id: usuarioId, cuenta_nueva: !existente },
  })

  return NextResponse.json({ ok: true, cuenta_nueva: !existente })
}

// DELETE: quita a un usuario del equipo de un proyecto (no elimina la cuenta,
// solo su membresía usuario_proyecto) — necesario para limpiar cuentas de
// prueba de un proyecto antes de entregarlo a un cliente real, sin tener que
// borrar la cuenta completa si se usa en otros proyectos.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!(await requireRole(user.id, ['super_admin']))) {
    return NextResponse.json({ error: 'Solo super_admin puede gestionar el equipo de un proyecto' }, { status: 403 })
  }

  const { usuario_id } = await req.json() as { usuario_id?: string }
  if (!usuario_id) return NextResponse.json({ error: 'Falta usuario_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existente } = await admin
    .from('usuario_proyecto')
    .select('usuario_id')
    .eq('proyecto_id', params.id)
    .eq('usuario_id', usuario_id)
    .maybeSingle()

  if (!existente) return NextResponse.json({ error: 'Esa persona no pertenece a este proyecto' }, { status: 404 })

  const { error } = await admin
    .from('usuario_proyecto')
    .delete()
    .eq('proyecto_id', params.id)
    .eq('usuario_id', usuario_id)

  if (error) return errorResponse(error, 500, 'No se pudo quitar al usuario del proyecto.')

  await registrarAudit({
    accion: 'DELETE',
    entidad: 'usuario_proyecto',
    entidad_id: `${params.id}:${usuario_id}`,
    detalle: { proyecto_id: params.id, usuario_id },
  })

  return NextResponse.json({ ok: true })
}
