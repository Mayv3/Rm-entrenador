import { useEffect, useRef } from "react"

/**
 * Mientras el modal está abierto, empuja una entrada al history para que el
 * gesto/botón "atrás" del celular cierre el modal en vez de navegar.
 * Si el modal se cierra por UI (no por atrás), limpia la entrada dummy.
 */
export function useDialogBackButton(
  open: boolean,
  onOpenChange?: (open: boolean) => void
) {
  // callback en ref -> el effect depende solo de `open` (evita re-push por
  // onOpenChange inline que cambia de identidad en cada render).
  const cbRef = useRef(onOpenChange)
  cbRef.current = onOpenChange

  const poppedRef = useRef(false)

  useEffect(() => {
    if (!open || typeof window === "undefined") return

    poppedRef.current = false
    window.history.pushState({ __dialog: true }, "", window.location.href)

    const handlePopState = () => {
      poppedRef.current = true
      cbRef.current?.(false)
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
      // Cerrado por UI (no por atrás): saca la entrada dummy que metimos.
      if (!poppedRef.current) {
        window.history.back()
      }
    }
  }, [open])
}
