import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Dumbbell } from "lucide-react"
import logoRodrigoEntrenador from "../assets/LOGO-RODRIGO-VERDE.png"

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08110d] px-6 py-10 text-zinc-100">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.08] blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center text-center">
        <Image src={logoRodrigoEntrenador} alt="Rodrigo Entrenador" width={142} priority className="mb-14" />

        <div className="mb-7 flex items-center gap-3 text-emerald-400">
          <span className="h-px w-12 bg-emerald-400/40" />
          <Dumbbell className="h-5 w-5 rotate-[-18deg]" />
          <span className="h-px w-12 bg-emerald-400/40" />
        </div>

        <p className="font-mono text-[clamp(5rem,18vw,10rem)] font-bold leading-[0.8] tracking-[-0.08em] text-emerald-400/90">404</p>
        <h1 className="mt-9 text-2xl font-semibold tracking-tight sm:text-3xl">Esta ruta no está en el plan.</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400 sm:text-base">
          La página que buscás no existe o cambió de lugar. Volvé al inicio y retomá tu entrenamiento.
        </p>

        <Link href="/" className="mt-9 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08110d]">
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
