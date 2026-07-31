"use client"

import axios from "axios"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, Image as ImageIcon, Loader2 } from "lucide-react"
import { queryKeys } from "@/lib/query-keys"
import type { ManualCapitulo } from "@/types/manual"

/**
 * Vista de sólo lectura del manual, pensada para el portal del alumno.
 * Comparte los datos con el editor del dashboard (misma query key).
 */
export function ManualViewer() {
  const { data: capitulos = [], isLoading, isError } = useQuery({
    queryKey: queryKeys.manual,
    queryFn: () =>
      axios.get<ManualCapitulo[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/manual`).then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando manual…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No se pudo cargar el manual. Probá de nuevo en un rato.
      </div>
    )
  }

  if (capitulos.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Todavía no hay contenido en el manual.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border dark:border-white/[0.06] bg-gradient-to-br from-[var(--primary-color)]/10 via-card to-card p-5">
  
        <h2 className="text-xl font-bold tracking-tight">Todo lo importante, explicado simple.</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Una guía rápida para moverte por el portal y cargar tus entrenamientos.
        </p>
      </div>

      {capitulos.map((capitulo) => (
        <article
          key={capitulo.id}
          className="overflow-hidden rounded-2xl border border-border dark:border-white/[0.06] bg-card"
        >
          <div className="p-5">
            {capitulo.eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--primary-color)]">
                {capitulo.eyebrow}
              </p>
            )}
            <h3 className="mt-1.5 text-lg font-bold tracking-tight">{capitulo.titulo}</h3>
            {capitulo.resumen && (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{capitulo.resumen}</p>
            )}

            <div className="mt-5 flex flex-col gap-4">
              {(capitulo.pasos ?? []).map((paso, index) => (
                <div key={paso.id ?? index} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-color)]/10 text-xs font-bold text-[var(--primary-color)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{paso.titulo}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{paso.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {capitulo.imagen_url && (
            <div className="border-t border-border dark:border-white/[0.06] bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Captura de referencia
              </div>
              <img
                src={capitulo.imagen_url}
                alt={`Captura de ${capitulo.titulo}`}
                className="mx-auto w-full max-w-[260px] rounded-xl border border-border dark:border-white/[0.06] object-contain shadow-sm"
              />
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
