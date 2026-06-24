'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck } from 'lucide-react'

// Traduce los mensajes de error de Supabase Auth a español claro para el usuario.
function traducirError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid') || m.includes('incorrect') || m.includes('verification')) {
    return 'Código inválido. Verifica que sea el código actual de tu app de autenticación e inténtalo de nuevo.'
  }
  if (m.includes('expired')) {
    return 'El código expiró. Ingresa el código actual que muestra tu app.'
  }
  if (m.includes('rate') || m.includes('too many')) {
    return 'Demasiados intentos. Espera unos segundos antes de volver a intentar.'
  }
  return 'No pudimos verificar el código. Inténtalo nuevamente.'
}

export default function MfaChallengePage() {
  const [factorId, setFactorId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [usarRecuperacion, setUsarRecuperacion] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function inicializar() {
      // Si la sesión ya alcanzó AAL2, no mostramos el formulario: vamos directo al dashboard.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === 'aal2') {
        router.replace("/bienvenida")
        return
      }

      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) {
        setError(traducirError(error.message))
        setCargando(false)
        return
      }
      const factor = data?.totp.find(f => f.status === 'verified')
      if (!factor) {
        router.push('/mfa/enroll')
        return
      }
      setFactorId(factor.id)
      setCargando(false)
    }
    inicializar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autosubmit cuando se completan los 6 dígitos (solo para código TOTP).
  useEffect(() => {
    if (!usarRecuperacion && !loading && factorId && codigo.length === 6) {
      verificar(codigo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, usarRecuperacion, factorId])

  async function verificar(code: string) {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })

    if (error) {
      setError(traducirError(error.message))
      setCodigo('')
      setLoading(false)
      return
    }

    router.replace("/bienvenida")
    router.refresh()
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    if (loading || !factorId) return
    verificar(codigo)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Verificación en dos pasos</h1>
          <p className="text-slate-400 text-sm mt-1">Ingresa el código de tu app de autenticación</p>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Confirma tu identidad</CardTitle>
            <CardDescription className="text-slate-400">
              Abre tu app de autenticación (Google Authenticator, Authy, etc.) e ingresa el código actual
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cargando ? (
              <p className="text-slate-400 text-sm">Verificando tu cuenta...</p>
            ) : (
              <form onSubmit={verificarCodigo} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo" className="text-slate-300">
                    {usarRecuperacion ? 'Código de recuperación' : 'Código de 6 dígitos'}
                  </Label>
                  <Input
                    id="codigo"
                    type="text"
                    inputMode={usarRecuperacion ? 'text' : 'numeric'}
                    maxLength={usarRecuperacion ? 20 : 6}
                    placeholder={usarRecuperacion ? 'xxxxx-xxxxx' : '000000'}
                    value={codigo}
                    onChange={e => setCodigo(
                      usarRecuperacion
                        ? e.target.value.trim()
                        : e.target.value.replace(/\D/g, '')
                    )}
                    required
                    autoFocus
                    className="bg-slate-700 border-slate-600 text-white text-center text-lg tracking-widest"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-950/50 px-3 py-2 rounded-md">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading || !factorId || (usarRecuperacion ? codigo.length < 6 : codigo.length !== 6)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {loading ? 'Verificando...' : 'Verificar e ingresar'}
                </Button>

                <button
                  type="button"
                  onClick={() => { setUsarRecuperacion(v => !v); setCodigo(''); setError('') }}
                  className="w-full text-center text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {usarRecuperacion ? 'Usar código de la app de autenticación' : 'Usar código de recuperación'}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
