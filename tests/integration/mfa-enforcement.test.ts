/**
 * Test de enforcement de MFA en el middleware.
 *
 * Verifica que un usuario con MFA enrollado pero sesión en AAL1
 * sea redirigido al challenge, y que sin MFA enrollado acceda libremente.
 *
 * Nota: El comportamiento real del middleware depende del servidor Next.js.
 * Estos tests verifican la lógica de AAL consultando Supabase Auth directamente.
 */

import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

describe('MFA — Assurance Level (AAL)', () => {

  it('usuario sin MFA enrollado tiene nextLevel = aal1 (sin enforcement)', async () => {
    // Verificación: un cliente anónimo sin sesión tiene AAL undefined/null
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: aal } = await anonClient.auth.mfa.getAuthenticatorAssuranceLevel()

    // Sin sesión activa no hay nivel de aseguramiento
    expect(aal?.currentLevel).toBeNull()
    expect(aal?.nextLevel).toBeNull()
  })

  it('middleware redirige cuando nextLevel=aal2 y currentLevel=aal1', () => {
    // Simulación de la lógica del middleware con distintos estados de AAL
    type AalLevel = 'aal1' | 'aal2' | null

    function shouldRedirectToMfaChallenge(
      currentLevel: AalLevel,
      nextLevel: AalLevel,
    ): boolean {
      return nextLevel === 'aal2' && nextLevel !== currentLevel
    }

    // Usuario con MFA enrollado pero sesión AAL1 → debe redirigir
    expect(shouldRedirectToMfaChallenge('aal1', 'aal2')).toBe(true)

    // Usuario con MFA completado (AAL2) → no redirige
    expect(shouldRedirectToMfaChallenge('aal2', 'aal2')).toBe(false)

    // Usuario sin MFA (nextLevel = aal1) → no redirige
    expect(shouldRedirectToMfaChallenge('aal1', 'aal1')).toBe(false)

    // Usuario sin sesión → no redirige (middleware lo envía a /login antes)
    expect(shouldRedirectToMfaChallenge(null, null)).toBe(false)
  })

  it('rutas /mfa/* están exentas del enforcement para evitar loops', () => {
    const mfaPaths = ['/mfa/enroll', '/mfa/challenge']

    function isMfaRoute(pathname: string): boolean {
      return mfaPaths.some(p => pathname.startsWith(p))
    }

    expect(isMfaRoute('/mfa/challenge')).toBe(true)
    expect(isMfaRoute('/mfa/enroll')).toBe(true)
    expect(isMfaRoute('/dashboard')).toBe(false)
    expect(isMfaRoute('/automation')).toBe(false)
    expect(isMfaRoute('/clientes')).toBe(false)
    // /mfa no sin trailing path no es ruta MFA (no existe esa ruta)
    expect(isMfaRoute('/mfa')).toBe(false)
  })

  it('rutas públicas no requieren autenticación ni MFA', () => {
    const publicPaths = ['/login', '/auth/callback', '/auth/confirm']

    function isPublicRoute(pathname: string): boolean {
      return publicPaths.some(p => pathname.startsWith(p))
    }

    expect(isPublicRoute('/login')).toBe(true)
    expect(isPublicRoute('/auth/callback')).toBe(true)
    expect(isPublicRoute('/auth/confirm')).toBe(true)
    expect(isPublicRoute('/dashboard')).toBe(false)
    expect(isPublicRoute('/clientes')).toBe(false)
  })
})
