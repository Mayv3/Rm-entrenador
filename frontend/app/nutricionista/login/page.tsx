"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import logoRodrigoEntrenador from "../../../assets/LOGO-RODRIGO-VERDE.png"

export default function NutricionistaLoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (localStorage.getItem("nutricionistaAuthenticated") === "true") router.replace("/nutricionista")
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)
    const formData = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/nutricionista-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: formData.get("username"), password: formData.get("password") }),
      })
      if (!response.ok) {
        setError("Usuario o contraseña incorrectos")
        return
      }
      localStorage.setItem("nutricionistaAuthenticated", "true")
      router.replace("/nutricionista")
    } catch {
      setError("No se pudo conectar. Intentá nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08110d] px-4 py-8 text-zinc-100">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-lime-500/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-sm flex-col justify-center gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image src={logoRodrigoEntrenador} alt="Rodrigo Entrenador" width={150} priority />
          <div><h1 className="text-xl font-semibold tracking-tight">Área de nutrición</h1><p className="mt-1 text-sm text-zinc-400">Ingresá para gestionar el seguimiento nutricional.</p></div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">Usuario<input name="username" type="text" autoComplete="username" required disabled={loading} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50" /></label>
          <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">Contraseña<input name="password" type="password" autoComplete="current-password" required disabled={loading} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50" /></label>
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-center text-xs text-red-300">{error}</p>}
          <button type="submit" disabled={loading} className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <><Loader2 className="h-4 w-4 animate-spin" />Ingresando...</> : "Ingresar"}</button>
        </form>
      </div>
    </main>
  )
}
