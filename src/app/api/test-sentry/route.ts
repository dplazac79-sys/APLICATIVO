import { NextResponse } from 'next/server'

export async function GET() {
  throw new Error('Test Sentry APAC — si ves esto en Sentry, está funcionando')
  // eslint-disable-next-line no-unreachable
  return NextResponse.json({ ok: true })
}
