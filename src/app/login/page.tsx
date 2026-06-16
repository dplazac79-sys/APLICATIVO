'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      router.push('/mfa/challenge')
    } else if (aal?.nextLevel === 'aal1') {
      // Usuario sin factor MFA configurado: lo exigimos antes de continuar
      router.push('/mfa/enroll')
    } else {
      router.push('/dashboard')
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md px-4">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
            <span className="text-white text-2xl font-bold">A</span>
          </div>
          <h1 className="text-3xl font-bold text-white">APIP</h1>
          <p className="text-slate-400 text-sm mt-1">AICOUNTS Process Intelligence Platform</p>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Iniciar sesión</CardTitle>
            <CardDescription className="text-slate-400">
              Ingresa tus credenciales para acceder a la plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-950/50 px-3 py-2 rounded-md">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
