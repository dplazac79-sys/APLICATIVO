'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck } from 'lucide-react'

export default function MfaEnrollPage() {
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cargandoEnroll, setCargandoEnroll] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const yaIniciado = useRef(false)

  useEffect(() => {
    if (yaIniciado.current) return
    yaIniciado.current = true

    async function iniciarEnrolamiento() {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const pendientes = factors?.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified') ?? []
      for (const pendiente of pendientes) {
        await supabase.auth.mfa.unenroll({ factorId: pendiente.id })
      }

      let { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })

      if (error?.message.includes('already exists')) {
        const { data: factorsRetry } = await supabase.auth.mfa.listFactors()
        const sobrantes = factorsRetry?.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified') ?? []
        for (const f of sobrantes) {
          await supabase.auth.mfa.unenroll({ factorId: f.id })
        }
        ;({ data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' }))
      }

      if (error || !data) {
        setError(error?.message ?? 'No se pudo iniciar el enrolamiento MFA')
        setCargandoEnroll(false)
        return
      }
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setCargandoEnroll(false)
    }
    iniciarEnrolamiento()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Activa la verificación en dos pasos</h1>
          <p className="text-slate-400 text-sm mt-1">ProcessOS requiere MFA para todos los perfiles</p>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Configura tu autenticador</CardTitle>
            <CardDescription className="text-slate-400">
              Escanea el código QR con Google Authenticator, Authy o cualquier app TOTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cargandoEnroll && <p className="text-slate-400 text-sm">Generando código QR...</p>}

            {qrCode && (
              <div className="bg-white rounded-lg p-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="Código QR para MFA" className="w-48 h-48" />
              </div>
            )}

            {secret && (
              <div className="bg-slate-900 rounded-md p-3">
                <p className="text-slate-500 text-xs mb-1">¿No puedes escanear? Ingresa este código manualmente:</p>
                <p className="text-slate-300 font-mono text-sm break-all">{secret}</p>
              </div>
            )}

            <form onSubmit={verificarCodigo} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codigo" className="text-slate-300">Código de 6 dígitos</Label>
                <Input
                  id="codigo"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
                  required
                  className="bg-slate-700 border-slate-600 text-white text-center text-lg tracking-widest"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-950/50 px-3 py-2 rounded-md">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading || !factorId || codigo.length !== 6}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {loading ? 'Verificando...' : 'Activar y continuar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
