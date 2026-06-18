"use client"

import { useEffect } from "react"
import { modalStack } from "@/lib/modal-stack"

/**
 * Evita que el gesto/botón "atrás" cierre la app (PWA).
 * Mantiene un entry centinela: cada vez que el usuario hace "atrás", se
 * vuelve a empujar el estado actual, así nunca se sale de la página.
 *
 * Coordina con useDialogBackButton vía modalStack: si hay un modal abierto,
 * NO interfiere -> el back lo cierra (el modal ya tiene su propio entry que
 * mantiene al usuario en la app). Sólo re-empuja cuando no hay modal.
 */
export function BackGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return

    // Centinela: garantiza que el primer "atrás" tenga algo que sacar
    // dentro de la app en vez de salir al sitio anterior / cerrar.
    window.history.pushState({ __backGuard: true }, "", window.location.href)

    const handlePopState = () => {
      // Hay un modal abierto: lo maneja useDialogBackButton (lo cierra).
      // No re-empujamos para no pelear con ese cierre.
      if (modalStack.isOpen()) return

      // Sin modal: re-empuja para que "atrás" nunca abandone la app.
      // (pushState no dispara popstate -> no genera loop.)
      window.history.pushState({ __backGuard: true }, "", window.location.href)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  return null
}
