import { useEffect, useRef } from 'react'

// Complementa useEscapeToClose para los mismos modales artesanales (fixed
// inset-0 z-50 + backdrop, sin pasar por ui/dialog.tsx): al abrir, mueve el
// foco adentro; mientras está abierto, Tab/Shift+Tab quedan atrapados
// dentro del modal en vez de escaparse al contenido de fondo; al cerrar,
// devuelve el foco al elemento que lo abrió. Antes ninguno de los tres pasos
// existía — un usuario de teclado podía tabular "a través" del modal hacia
// botones ocultos detrás, y perdía su posición en la página al cerrar.
export function useFocusTrap(open: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement as HTMLElement | null
    const container = containerRef.current
    if (!container) return

    function focusables(): HTMLElement[] {
      if (!container) return []
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => el.offsetParent !== null)
    }

    // Si ya hay un campo con autoFocus, el navegador ya lo enfocó — esto es
    // solo un respaldo por si ese campo no está disponible.
    if (!container.contains(document.activeElement)) {
      focusables()[0]?.focus()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      triggerRef.current?.focus()
    }
  }, [open])

  return containerRef
}
