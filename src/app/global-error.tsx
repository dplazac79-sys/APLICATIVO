'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="w-16 h-16 bg-red-950 rounded-2xl flex items-center justify-center mx-auto text-3xl">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-white">Algo salió mal</h1>
          <p className="text-slate-400 text-sm">
            Nuestro equipo fue notificado automáticamente. Puedes intentar recargar la página.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 font-mono">ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  )
}
