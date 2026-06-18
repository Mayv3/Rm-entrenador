import { useEffect, useRef } from "react"
import { modalStack } from "@/lib/modal-stack"

/**
 * Mientras el modal está abierto, empuja una entrada al history para que el
 * gesto/botón "atrás" del celular cierre el modal en vez de navegar.
 *
 * También registra el modal en `modalStack` para que BackGuard (dashboard)
 * sepa que hay un modal abierto y no interfiera con el cierre.
 */
export function useDialogBackButton(
  open: boolean,
  onOpenChange?: (open: boolean) => void
) {
  // callback en ref -> el effect depende solo de `open` (evita re-push por
  // onOpenChange inline que cambia de identidad en cada render).
  const cbRef = useRef(onOpenChange)
  cbRef.current = onOpenChange

  useEffect(() => {
    if (!open || typeof window === "undefined") return

    modalStack.open()
    window.history.pushState({ __dialog: true }, "", window.location.href)

    const handlePopState = () => {
      cbRef.current?.(false)
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
      modalStack.close()
    }
  }, [open])
}
