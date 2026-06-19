import { NextResponse } from 'next/server'

export async function GET() {
  throw new Error('Test Sentry APAC — si ves esto en Sentry, está funcionando correctamente')
  return NextResponse.json({ ok: true })
}
