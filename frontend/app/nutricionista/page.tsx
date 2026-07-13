"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Salad } from "lucide-react"
import { NutricionSection } from "@/components/nutricion/nutricion-section"

export default function NutricionistaPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (localStorage.getItem("nutricionistaAuthenticated") !== "true") {
      router.replace("/nutricionista/login")
      return
    }
    setReady(true)
  }, [router])

  function handleLogout() {
    localStorage.removeItem("nutricionistaAuthenticated")
    router.replace("/nutricionista/login")
  }

  if (!ready) return <div className="min-h-screen bg-background" />

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><Salad className="h-5 w-5" /></div><div><p className="text-sm font-semibold">Área de nutrición</p><p className="text-[11px] text-muted-foreground">Seguimiento de alumnos</p></div></div>
          <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Cerrar sesión"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Cerrar sesión</span></button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"><NutricionSection /></main>
    </div>
  )
}
