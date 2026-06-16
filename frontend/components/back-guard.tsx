"use client"

import { useEffect } from "react"

/**
 * Evita que el gesto/botón "atrás" cierre la app (PWA).
 * Mantiene un entry centinela: cada vez que el usuario hace "atrás", se
 * vuelve a empujar el estado actual, así nunca se sale de la página.
 *
 * Los modales abren su propio entry (useDialogBackButton): cuando hay un modal
 * abierto, el "atrás" lo cierra; cuando no hay modal, este guard mantiene al
 * usuario dentro de la app.
 */
export function BackGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return

    // Centinela: garantiza que el primer "atrás" tenga algo que sacar
    // dentro de la app en vez de salir al sitio anterior / cerrar.
    window.history.pushState({ __backGuard: true }, "", window.location.href)

    const handlePopState = () => {
      // Re-empuja para que "atrás" nunca abandone la app.
      // (pushState no dispara popstate -> no genera loop.)
      window.history.pushState({ __backGuard: true }, "", window.location.href)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  return null
}
