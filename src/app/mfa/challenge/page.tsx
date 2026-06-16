'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck } from 'lucide-react'

export default function MfaChallengePage() {
  const [factorId, setFactorId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cargando, setCargando] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function buscarFactor() {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) {
        setError(error.message)
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
    buscarFactor()
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
                    autoFocus
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
                  {loading ? 'Verificando...' : 'Verificar e ingresar'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
