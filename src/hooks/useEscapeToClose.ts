import { useEffect } from 'react'

// Cierre por Escape para modales artesanales (fixed inset-0 z-50 + backdrop
// onClick) que no pasan por el primitivo ui/dialog.tsx — antes solo se
// podían cerrar con el mouse (click en el fondo o botón X), dejando a
// usuarios de teclado atrapados con tab hacia contenido de fondo.
export function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
}
