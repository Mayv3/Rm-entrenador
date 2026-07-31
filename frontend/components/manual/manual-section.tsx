"use client"

import { useEffect, useRef, useState } from "react"
import axios from "axios"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDown, ArrowUp, BookOpen, Check, Edit3, Image as ImageIcon,
  Loader2, Plus, Save, Trash2, Upload, X,
} from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { queryKeys } from "@/lib/query-keys"
import type { ManualCapitulo } from "@/types/manual"

const BUCKET = "manual"

/** Marca temporal para capítulos todavía no persistidos (el backend los inserta sin id). */
type DraftCapitulo = ManualCapitulo & { _key: string }

const nuevoKey = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

function aDraft(capitulos: ManualCapitulo[]): DraftCapitulo[] {
  return capitulos.map((cap) => ({ ...cap, pasos: cap.pasos ?? [], _key: cap.id ? `cap-${cap.id}` : nuevoKey() }))
}

function ScreenPlaceholder() {
  return (
    <div className="flex aspect-[9/16] w-full max-w-[280px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/20 text-muted-foreground">
      <ImageIcon className="h-6 w-6" />
      <p className="text-xs">Sin captura</p>
    </div>
  )
}

export function ManualSection() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DraftCapitulo[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  // Imágenes del bucket que quedaron huérfanas al reemplazar o quitar una captura.
  // Se borran recién al guardar, para que cancelar no destruya nada.
  const pathsABorrar = useRef<string[]>([])
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  // Al scrollear, el header sticky se achica: se ocultan título y bajada y
  // quedan solo los botones de acción.
  // Umbrales distintos para colapsar (>140) y expandir (<60): al colapsar la
  // página se acorta y el scroll retrocede solo, así que con un único umbral
  // quedaba oscilando entre los dos estados.
  const [compacto, setCompacto] = useState(false)
  useEffect(() => {
    const onScroll = () =>
      setCompacto((prev) => (prev ? window.scrollY > 60 : window.scrollY > 140))
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const { data: capitulos = [], isLoading } = useQuery({
    queryKey: queryKeys.manual,
    queryFn: () =>
      axios.get<ManualCapitulo[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/manual`).then((r) => r.data),
  })

  useEffect(() => {
    if (!editing) setDraft(aDraft(capitulos))
  }, [capitulos, editing])

  const vista = editing ? draft : aDraft(capitulos)

  const patchCapitulo = (key: string, cambios: Partial<ManualCapitulo>) =>
    setDraft((actual) => actual.map((cap) => (cap._key === key ? { ...cap, ...cambios } : cap)))

  const patchPaso = (key: string, index: number, cambios: Partial<{ titulo: string; texto: string }>) =>
    setDraft((actual) =>
      actual.map((cap) =>
        cap._key === key
          ? { ...cap, pasos: cap.pasos.map((paso, i) => (i === index ? { ...paso, ...cambios } : paso)) }
          : cap,
      ),
    )

  const agregarPaso = (key: string) =>
    setDraft((actual) =>
      actual.map((cap) => (cap._key === key ? { ...cap, pasos: [...cap.pasos, { titulo: "", texto: "" }] } : cap)),
    )

  const quitarPaso = (key: string, index: number) =>
    setDraft((actual) =>
      actual.map((cap) => (cap._key === key ? { ...cap, pasos: cap.pasos.filter((_, i) => i !== index) } : cap)),
    )

  const agregarCapitulo = () =>
    setDraft((actual) => [
      ...actual,
      {
        _key: nuevoKey(),
        eyebrow: `${String(actual.length + 1).padStart(2, "0")} · Nueva sección`,
        titulo: "Nuevo capítulo",
        resumen: "",
        imagen_url: null,
        imagen_path: null,
        pasos: [{ titulo: "", texto: "" }],
      },
    ])

  const quitarCapitulo = (key: string) =>
    setDraft((actual) => {
      const cap = actual.find((c) => c._key === key)
      if (cap?.imagen_path) pathsABorrar.current.push(cap.imagen_path)
      return actual.filter((c) => c._key !== key)
    })

  const moverCapitulo = (key: string, delta: -1 | 1) =>
    setDraft((actual) => {
      const i = actual.findIndex((c) => c._key === key)
      const j = i + delta
      if (i < 0 || j < 0 || j >= actual.length) return actual
      const copia = [...actual]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })

  async function subirImagen(key: string, file: File) {
    if (!file.type.startsWith("image/")) {
      setError("El archivo tiene que ser una imagen")
      return
    }
    setUploadingKey(key)
    setError(null)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const bucketPath = `${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(bucketPath, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(bucketPath)

      const anterior = draft.find((c) => c._key === key)?.imagen_path
      if (anterior) pathsABorrar.current.push(anterior)

      patchCapitulo(key, { imagen_url: data.publicUrl, imagen_path: bucketPath })
    } catch (err) {
      console.error("Error subiendo la captura:", err)
      setError("No se pudo subir la imagen. Revisá la conexión e intentá de nuevo.")
    } finally {
      setUploadingKey(null)
    }
  }

  function quitarImagen(key: string) {
    const cap = draft.find((c) => c._key === key)
    if (cap?.imagen_path) pathsABorrar.current.push(cap.imagen_path)
    patchCapitulo(key, { imagen_url: null, imagen_path: null })
  }

  function cancelar() {
    // Las imágenes recién subidas quedan en el bucket; no se referencian y no
    // rompen nada, pero tampoco se borran acá porque el draft ya se descarta.
    pathsABorrar.current = []
    setDraft(aDraft(capitulos))
    setEditing(false)
    setError(null)
  }

  async function guardar() {
    setSaving(true)
    setError(null)
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/manual`, {
        capitulos: draft.map(({ _key, ...cap }) => cap),
      })

      if (pathsABorrar.current.length) {
        await supabase.storage.from(BUCKET).remove(pathsABorrar.current)
        pathsABorrar.current = []
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.manual })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2400)
    } catch (err) {
      console.error("Error guardando el manual:", err)
      setError("No se pudo guardar el manual. Revisá la conexión e intentá de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 pb-8">
      {/* Sticky bajo el header del dashboard (h-16) para tener siempre a mano
          Guardar/Cancelar sin volver al tope de la página. */}
      <div className={`sticky top-16 md:top-2 z-30 flex flex-col gap-4 rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card shadow-sm backdrop-blur transition-all duration-200 sm:flex-row sm:items-end sm:justify-between ${compacto ? "p-3 sm:items-center sm:p-4" : "p-6 sm:p-8"}`}>
        <div className="min-w-0">
          <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary ${compacto ? "" : "mb-3"}`}>
            <BookOpen className="h-4 w-4" /> Manual de uso
          </div>
          {/* Título y bajada se colapsan al scrollear para no comer alto. */}
          <div className={`grid transition-all duration-200 ${compacto ? "[grid-template-rows:0fr] opacity-0" : "[grid-template-rows:1fr] opacity-100"}`}>
            <div className="overflow-hidden min-h-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Todo lo importante, explicado simple.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Una guía rápida para cargar alumnos, crear planes y acompañar el entrenamiento desde un solo lugar.
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {editing && (
            <button
              onClick={cancelar}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition hover:bg-muted/40 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          )}
          <button
            onClick={editing ? guardar : () => setEditing(true)}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {editing ? (
              saving ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</> : <><Save className="h-4 w-4" />Guardar manual</>
            ) : (
              <><Edit3 className="h-4 w-4" />Editar manual</>
            )}
          </button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          <Check className="h-4 w-4" />
          Manual guardado.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <X className="h-4 w-4" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando manual…
        </div>
      ) : vista.length === 0 ? (
        <div className="rounded-3xl border bg-card py-16 text-center text-sm text-muted-foreground">
          Todavía no hay capítulos. Entrá en modo edición para crear el primero.
        </div>
      ) : (
        <div className="grid gap-5">
          {vista.map((chapter, chapterIndex) => (
            <article key={chapter._key} className="overflow-hidden rounded-3xl border bg-card">
              <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
                <div className="p-5 sm:p-7">
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={chapter.eyebrow ?? ""}
                        onChange={(e) => patchCapitulo(chapter._key, { eyebrow: e.target.value })}
                        placeholder="01 · Primer ingreso"
                        className="w-full rounded-md border bg-background px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        onClick={() => moverCapitulo(chapter._key, -1)}
                        disabled={chapterIndex === 0}
                        title="Subir capítulo"
                        className="rounded-md border p-1.5 transition hover:bg-muted/40 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moverCapitulo(chapter._key, 1)}
                        disabled={chapterIndex === vista.length - 1}
                        title="Bajar capítulo"
                        className="rounded-md border p-1.5 transition hover:bg-muted/40 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => quitarCapitulo(chapter._key)}
                        title="Eliminar capítulo"
                        className="rounded-md border p-1.5 text-red-500 transition hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{chapter.eyebrow}</p>
                  )}

                  {editing ? (
                    <input
                      value={chapter.titulo}
                      onChange={(e) => patchCapitulo(chapter._key, { titulo: e.target.value })}
                      placeholder="Título del capítulo"
                      className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  ) : (
                    <h2 className="mt-2 text-xl font-bold tracking-tight">{chapter.titulo}</h2>
                  )}

                  {editing ? (
                    <textarea
                      value={chapter.resumen ?? ""}
                      onChange={(e) => patchCapitulo(chapter._key, { resumen: e.target.value })}
                      placeholder="Resumen corto de la sección"
                      className="mt-3 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{chapter.resumen}</p>
                  )}

                  <div className="mt-6 space-y-4">
                    {chapter.pasos.map((step, index) => (
                      <div key={step.id ?? index} className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          {editing ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={step.titulo}
                                onChange={(e) => patchPaso(chapter._key, index, { titulo: e.target.value })}
                                placeholder="Título del paso"
                                className="w-full rounded-md border bg-background px-2 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                              />
                              <button
                                onClick={() => quitarPaso(chapter._key, index)}
                                title="Eliminar paso"
                                className="shrink-0 rounded-md border p-1.5 text-red-500 transition hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold">{step.titulo}</p>
                          )}
                          {editing ? (
                            <textarea
                              value={step.texto}
                              onChange={(e) => patchPaso(chapter._key, index, { texto: e.target.value })}
                              placeholder="Explicación del paso"
                              className="mt-1 min-h-16 w-full rounded-md border bg-background px-2 py-1.5 text-sm leading-5 outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          ) : (
                            <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.texto}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {editing && (
                      <button
                        onClick={() => agregarPaso(chapter._key)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar paso
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t bg-muted/20 p-4 sm:p-5 lg:border-l lg:border-t-0">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" /> Captura de referencia
                  </div>

                  {chapter.imagen_url ? (
                    <img
                      src={chapter.imagen_url}
                      alt={`Captura de ${chapter.titulo}`}
                      className="mx-auto w-full max-w-[280px] rounded-2xl border object-contain shadow-sm"
                    />
                  ) : (
                    <div className="mx-auto w-full max-w-[280px]">
                      <ScreenPlaceholder />
                    </div>
                  )}

                  {editing && (
                    <div className="mx-auto mt-3 flex w-full max-w-[280px] flex-col gap-2">
                      <input
                        ref={(el) => { fileInputs.current[chapter._key] = el }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) subirImagen(chapter._key, file)
                          e.target.value = ""
                        }}
                      />
                      <button
                        onClick={() => fileInputs.current[chapter._key]?.click()}
                        disabled={uploadingKey === chapter._key}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted/40 disabled:opacity-50"
                      >
                        {uploadingKey === chapter._key ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" />Subiendo…</>
                        ) : (
                          <><Upload className="h-3.5 w-3.5" />{chapter.imagen_url ? "Cambiar imagen" : "Subir imagen"}</>
                        )}
                      </button>
                      {chapter.imagen_url && (
                        <button
                          onClick={() => quitarImagen(chapter._key)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Quitar imagen
                        </button>
                      )}
                    </div>
                  )}

        
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <button
          onClick={agregarCapitulo}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed py-6 text-sm font-semibold text-muted-foreground transition hover:bg-muted/30"
        >
          <Plus className="h-4 w-4" />
          Agregar capítulo
        </button>
      )}
    </section>
  )
}
