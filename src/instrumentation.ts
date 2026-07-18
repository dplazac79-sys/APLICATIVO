// Corre una sola vez cuando arranca el proceso del servidor (Next.js
// instrumentation hook) — en Railway eso pasa exactamente en cada deploy,
// ya que `node .next/standalone/server.js` es un proceso nuevo por deploy.
//
// Sincroniza el registro de funciones de Inngest automáticamente. Antes
// esto había que hacerlo a mano pegándole a PUT /api/inngest después de
// cada deploy — Railway no está en la lista de plataformas con auto-sync
// de Inngest (a diferencia de Vercel/Netlify). Sin sincronizar, Inngest
// no se entera de funciones nuevas o modificadas y los eventos que la app
// envía quedan sin ningún handler que los reciba, fallando en silencio
// (así se descubrió: el análisis de Glosario de Roles se quedaba en
// "generando" para siempre porque el evento nunca tenía destino).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return

  const port = process.env.PORT ?? '3000'
  const intentarSync = async (intento: number) => {
    try {
      const res = await fetch(`http://localhost:${port}/api/inngest`, { method: 'PUT' })
      if (res.ok) {
        console.log('[inngest-sync] Registro sincronizado tras el deploy.')
      } else {
        console.error(`[inngest-sync] Falló con status ${res.status} (intento ${intento})`)
      }
    } catch (err) {
      // El servidor HTTP puede no estar escuchando todavía cuando register()
      // corre — es esperado en el primer intento, por eso hay reintentos.
      if (intento < 3) {
        setTimeout(() => intentarSync(intento + 1), 5000)
      } else {
        console.error('[inngest-sync] No se pudo sincronizar tras 3 intentos:', err instanceof Error ? err.message : err)
      }
      return
    }
  }

  // Pequeña espera inicial para dar tiempo a que el servidor HTTP esté escuchando.
  setTimeout(() => intentarSync(1), 3000)
}
