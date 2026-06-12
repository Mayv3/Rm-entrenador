"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CATEGORIA_ROW_STYLE } from "@/types/planificaciones"
import { setSaveStatus } from "@/lib/save-status"
import { CardSaveBadge } from "@/components/portal/card-save-badge"
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  CalendarDays,
  Repeat,
  CheckCircle2,
  Flame,
  Weight,
  RotateCcw,
  StickyNote,
  Trophy,
  Play,
  X,
  SkipForward,
  Moon,
  BatteryWarning,
  Frown,
  Activity,
  Eye,
} from "lucide-react"

interface PlanSemana {
  semana: number
  dosis: string | null
  rpe: number | null
  notas_profesor?: string | null
}

interface PlanEjercicioPortal {
  id: number
  planificacion_dia_id: number
  ejercicio_id: number
  categoria: string
  orden: number
  series?: number | null
  ejercicios: {
    id: number
    nombre: string
    grupo_muscular: string | null
    video_url: string | null
  } | null
  semanas: PlanSemana[]
}

interface PlanDiaPortal {
  id: number
  hoja_id: number
  numero_dia: number
  nombre: string
  orden: number
  ejercicios: PlanEjercicioPortal[]
}

interface MovilidadItem {
  id: number
  nombre: string
  imagen_url: string | null
  video_url: string | null
  orden: number
}

interface PlanHojaPortal {
  id: number
  nombre: string
  numero: number
  estado: string
  movilidad: MovilidadItem[]
  dias: PlanDiaPortal[]
}

interface PlanificacionPortal {
  id: number
  nombre: string
  semanas: number
  hoja_activa_id: number | null
  hojas: PlanHojaPortal[]
}

interface SerieRegistro {
  peso_kg: number | null
  repeticiones: number | null
  rpe: number | null
}

interface RegistroSesion {
  id: number
  planificacion_ejercicio_id: number
  peso_kg: number | null
  repeticiones: number | null
  rpe: number | null
  notas: string | null
  series: SerieRegistro[] | null
}

interface SsnData {
  sesion: { id: number; estado: string | null } | null
  estado_diario: { durmio_mal?: boolean; fatiga?: boolean; desmotivacion?: boolean; dolor?: boolean; excelente?: boolean } | null
  registros: RegistroSesion[]
}

type SerieRow = {
  peso_kg: string
  repeticiones: string
  rpe: string
}

type FormRow = {
  series: SerieRow[]
  notas: string
}

const EMPTY_SERIE: SerieRow = { peso_kg: "", repeticiones: "", rpe: "" }
const DEFAULT_SERIES = 3
// Paso 3: el envío a red se debounce para coalescer la ráfaga de saves por-serie.
// La persistencia local (persistFormLocal) sigue siendo inmediata en cada tecla.
const SAVE_DEBOUNCE_MS = 1500
// Pendiente 11: ms de inactividad en un input antes de saltar al próximo
const FIELD_IDLE_MS = 2000
const clampSeries = (v: unknown) => Math.min(8, Math.max(1, Number(v) || DEFAULT_SERIES))
const EMPTY_FORM_ROW = (count: number = DEFAULT_SERIES): FormRow => ({
  series: Array.from({ length: count }, () => ({ ...EMPTY_SERIE })),
  notas: "",
})
// Ajusta un array de series a `count` (pad con vacías / trunca)
const padSeries = (arr: SerieRow[] | undefined, count: number): SerieRow[] =>
  Array.from({ length: count }, (_, i) => arr?.[i] ?? { ...EMPTY_SERIE })


const queryKeyPlan = (studentId: number) => ["portalPlanificacion", studentId] as const
const queryKeySesion = (planId: number, studentId: number, hojaId: number, diaId: number, semana: number) =>
  ["portalSesion", planId, studentId, hojaId, diaId, semana] as const

export function StudentPlanificacionSection({
  studentId,
  onRequestClose,
  historyDepthRef,
}: {
  studentId: number
  onRequestClose?: () => void
  historyDepthRef?: React.MutableRefObject<number>
}) {
  const queryClient = useQueryClient()
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<number | null>(null)
  const [diaSeleccionadoId, setDiaSeleccionadoId] = useState<number | null>(null)
  const [registrosForm, setRegistrosForm] = useState<Record<number, FormRow>>({})
  const [saveMessage, setSaveMessage] = useState<string>("")
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [videoModal, setVideoModal] = useState<{ nombre: string; url: string } | null>(null)
  const isDirty = useRef(false)
  const estadoDirty = useRef(false)
  const dirtyEjIds = useRef(new Set<number>())
  const saveStatusResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingResaveRef = useRef(false)
  const savingEjIdsRef = useRef<number[]>([])
  // SAVE-001: tracking de ediciones hechas MIENTRAS hay un save in-flight, para no
  // borrarlas en onSuccess (el clear ciego anterior perdía ese dato en DB y localStorage).
  const savingEstadoRef = useRef(false) // ¿el save in-flight incluía estado de salud?
  const dirtyDuringSaveRef = useRef(new Set<number>()) // ejIds re-editados durante el save in-flight
  const estadoDirtyDuringSaveRef = useRef(false) // estado re-tocado durante el save in-flight
  const clientRevRef = useRef(0) // rev monotónico para LWW server-side (anti-reordenamiento de red)
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const silentSaveRef = useRef(false)
  const currentSaveIsSilentRef = useRef(false)
  const onRequestCloseRef = useRef(onRequestClose)
  onRequestCloseRef.current = onRequestClose
  const refetchResumenRef = useRef<(() => void) | null>(null)
  const refetchSesionesSemanaRef = useRef<(() => void) | null>(null)
  const [saltadoEjIds, setSaltadoEjIds] = useState<Set<number>>(new Set())
  const [durmioMal, setDurmioMal] = useState(false)
  const [fatiga, setFatiga] = useState(false)
  const [desmotivacion, setDesmotivacion] = useState(false)
  const [dolor, setDolor] = useState(false)
  const [excelente, setExcelente] = useState(false)
  const durmioMalRef = useRef(false)
  const fatigaRef = useRef(false)
  const desmotivacionRef = useRef(false)
  const dolorRef = useRef(false)
  const excelenteRef = useRef(false)
  const [checkinMostrado, setCheckinMostrado] = useState(false)
  const [estadoLocalDirty, setEstadoLocalDirty] = useState(false)
  const justSavedRef = useRef(false)
  const [activeSerieMap, setActiveSerieMap] = useState<Record<number, number>>({})
  const serieScrollRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const pendingSerieRestoreRef = useRef<Record<number, number>>({})
  const exerciseCardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [movilidadIdx, setMovilidadIdx] = useState(0)
  const movilidadScrollRef = useRef<HTMLDivElement | null>(null)
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const serieAdvanceDebounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Pendiente 11: idle por-input. 3s sin escribir en un input → saltar al próximo.
  const fieldIdleTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const registrosFormRef = useRef<Record<number, FormRow>>({})
  const [previewPlan, setPreviewPlan] = useState(false)
  const didRestoreNavRef = useRef(false)

  const clampSerieValue = (field: keyof SerieRow, value: string): string => {
    if (value === "") return ""
    const normalized = value.replace(",", ".")
    if (field === "repeticiones") {
      const num = parseInt(normalized, 10)
      if (isNaN(num)) return ""
      return String(Math.min(30, Math.max(1, num)))
    }
    if (/^\d*\.?\d*$/.test(normalized) === false) return ""
    if (normalized === "." || normalized.endsWith(".")) return normalized
    const num = parseFloat(normalized)
    if (isNaN(num)) return ""
    if (field === "peso_kg") return String(Math.min(500, Math.max(0, num)))
    if (field === "rpe") return String(Math.min(10, Math.max(1, num)))
    return value
  }

  const focusNextInput = (ejId: number, serieIdx: number, field: keyof SerieRow) => {
    const fields: (keyof SerieRow)[] = ["peso_kg", "repeticiones", "rpe"]
    const currentIdx = fields.indexOf(field)
    if (currentIdx < fields.length - 1) {
      inputRefs.current.get(`${ejId}-${serieIdx}-${fields[currentIdx + 1]}`)?.focus()
    }
  }

  const getActiveSerie = (ejId: number) => activeSerieMap[ejId] ?? 0

  const posStorageKey = semanaSeleccionada != null && diaSeleccionadoId != null
    ? `planPos-${studentId}-${semanaSeleccionada}-${diaSeleccionadoId}`
    : null

  const formStorageKey = semanaSeleccionada != null && diaSeleccionadoId != null
    ? `planForm-${studentId}-${semanaSeleccionada}-${diaSeleccionadoId}`
    : null
  const formStorageKeyRef = useRef<string | null>(null)
  formStorageKeyRef.current = formStorageKey

  const persistFormLocal = (form: Record<number, FormRow>, saltados: Set<number>) => {
    const key = formStorageKeyRef.current
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify({
        form,
        saltados: Array.from(saltados),
        ts: Date.now(),
      }))
    } catch {}
  }

  const clearFormLocal = () => {
    const key = formStorageKeyRef.current
    if (!key) return
    try { localStorage.removeItem(key) } catch {}
  }

  // Posición de scroll/serie. Antes vivía en sessionStorage, que se BORRA cuando el SO
  // mata la PWA en segundo plano (celulares con poca RAM, ej. A16). localStorage sobrevive
  // al cierre del proceso → al reabrir queda "suspendido" en el mismo lugar. TTL 24h para
  // no restaurar una posición vieja de días atrás.
  const POS_TTL_MS = 24 * 60 * 60 * 1000
  const readPos = (key: string | null): Record<string, any> | null => {
    if (!key) return null
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const p = JSON.parse(raw)
      if (p && typeof p.ts === "number" && Date.now() - p.ts > POS_TTL_MS) {
        localStorage.removeItem(key)
        return null
      }
      return p
    } catch { return null }
  }
  const writePos = (key: string | null, patch: Record<string, unknown>) => {
    if (!key) return
    try {
      const cur = readPos(key) ?? {}
      localStorage.setItem(key, JSON.stringify({ ...cur, ...patch, ts: Date.now() }))
    } catch {}
  }

  const scrollToSerie = (ejId: number, idx: number) => {
    const el = serieScrollRefs.current.get(ejId)
    if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" })
    setActiveSerieMap((prev) => {
      const next = { ...prev, [ejId]: idx }
      writePos(posStorageKey, { activeSerieMap: next, lastEjId: ejId })
      return next
    })
  }

  const handleSerieScroll = (ejId: number, el: HTMLDivElement) => {
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActiveSerieMap((prev) => {
      if (prev[ejId] === idx) return prev
      const next = { ...prev, [ejId]: idx }
      writePos(posStorageKey, { activeSerieMap: next, lastEjId: ejId })
      return next
    })
  }

  // Persist window scrollY on day view: covers phone lock / app switch / minimize.
  // Pairs with restore branch inside the registrosForm-building effect below.
  useEffect(() => {
    if (!posStorageKey) return
    if (typeof window === "undefined") return
    if ("scrollRestoration" in history) history.scrollRestoration = "manual"

    let raf = 0
    const save = () => {
      writePos(posStorageKey, { scrollY: window.scrollY })
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { save(); raf = 0 })
    }
    const onHide = () => save()

    window.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onHide)
    return () => {
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onHide)
      if (raf) cancelAnimationFrame(raf)
      if ("scrollRestoration" in history) history.scrollRestoration = "auto"
    }
  }, [posStorageKey])

  const { data: planData, isLoading: loadingPlan, isError: errorPlan } = useQuery<{ planificacion: PlanificacionPortal | null }>({
    queryKey: queryKeyPlan(studentId),
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/alumnos/${studentId}/planificacion`)
      return res.data
    },
    enabled: !!studentId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  })

  const planificacion = planData?.planificacion ?? null

  useEffect(() => {
    setSemanaSeleccionada(null)
    setDiaSeleccionadoId(null)
    registrosFormRef.current = {}
    setRegistrosForm({})
    setSaltadoEjIds(new Set())
    setCheckinMostrado(false)
    setSaveMessage("")
    setSavedSuccess(false)
    dirtyEjIds.current.clear()
    setPreviewPlan(false)
  }, [planificacion?.id])

  // Guarda la semana/día actual para poder reanudar tras un cold start (SO mató la PWA).
  // No escribe hasta intentar restaurar, para no pisar el valor guardado en el arranque.
  useEffect(() => {
    if (!didRestoreNavRef.current) return
    if (!studentId || !planificacion?.id) return
    try {
      if (semanaSeleccionada == null) {
        localStorage.removeItem(`rmPlanNav-${studentId}`)
      } else {
        localStorage.setItem(`rmPlanNav-${studentId}`, JSON.stringify({
          planId: planificacion.id,
          semana: semanaSeleccionada,
          diaId: diaSeleccionadoId,
          ts: Date.now(),
        }))
      }
    } catch {}
  }, [studentId, planificacion?.id, semanaSeleccionada, diaSeleccionadoId])

  const hojaActiva = useMemo(() => {
    if (!planificacion) return null
    return (
      planificacion.hojas.find((h) => h.id === planificacion.hoja_activa_id) ||
      planificacion.hojas[0] ||
      null
    )
  }, [planificacion])

  // Hoja anterior (bloque previo) dentro del mismo plan — fuente de pesos para semana 1
  const hojaAnterior = useMemo(() => {
    if (!planificacion || !hojaActiva) return null
    const ordenadas = [...(planificacion.hojas ?? [])].sort((a, b) => a.numero - b.numero)
    const idx = ordenadas.findIndex((h) => h.id === hojaActiva.id)
    return idx > 0 ? ordenadas[idx - 1] : null
  }, [planificacion, hojaActiva])

  const dias = hojaActiva?.dias ?? []
  const totalSemanas = Math.max(1, planificacion?.semanas ?? 1)

  const diaSeleccionado = useMemo(
    () => dias.find((d) => d.id === diaSeleccionadoId) || null,
    [dias, diaSeleccionadoId]
  )

  const CATEGORIA_ORDER: Record<string, number> = { ACTIVADOR: 0, A: 1, B: 2, C: 3, D: 4, E: 5 }
  const esAccesorio = (cat: string | null | undefined) => (cat ?? "").toUpperCase() === "ACTIVADOR"

  // Accesorios (activadores): solo vista, no se completan ni se guardan
  const accesorios = useMemo(
    () =>
      [...(diaSeleccionado?.ejercicios ?? [])]
        .filter((e) => esAccesorio(e.categoria))
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    [diaSeleccionado]
  )

  const ejerciciosDelDia = useMemo(
    () =>
      [...(diaSeleccionado?.ejercicios ?? [])]
        .filter((e) => !esAccesorio(e.categoria))
        .sort(
          (a, b) =>
            (CATEGORIA_ORDER[a.categoria ?? ""] ?? 99) - (CATEGORIA_ORDER[b.categoria ?? ""] ?? 99)
        ),
    [diaSeleccionado]
  )

  // Cantidad de series por ejercicio (la define el profesor; default 3)
  const ejerciciosDelDiaRef = useRef(ejerciciosDelDia)
  ejerciciosDelDiaRef.current = ejerciciosDelDia
  const getSeriesCount = (planEjId: number) =>
    clampSeries(ejerciciosDelDiaRef.current.find((e) => e.id === planEjId)?.series)

  const { data: sessionData, isFetching: loadingSession } = useQuery<SsnData>({
    queryKey: queryKeySesion(
      planificacion?.id ?? 0,
      studentId,
      hojaActiva?.id ?? 0,
      diaSeleccionado?.id ?? 0,
      semanaSeleccionada ?? 0
    ),
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/planificaciones/${planificacion!.id}/sesiones`, {
        params: {
          alumno_id: studentId,
          hoja_id: hojaActiva!.id,
          dia_id: diaSeleccionado!.id,
          semana: semanaSeleccionada,
        },
      })
      return res.data
    },
    enabled: !!planificacion && !!hojaActiva && !!diaSeleccionado && !!semanaSeleccionada,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (
      planificacion &&
      hojaActiva &&
      diaSeleccionado &&
      semanaSeleccionada &&
      !justSavedRef.current
    ) {
      queryClient.invalidateQueries({
        queryKey: queryKeySesion(planificacion.id, studentId, hojaActiva.id, diaSeleccionado.id, semanaSeleccionada),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaSeleccionado?.id, semanaSeleccionada])

  const semanaAnterior = semanaSeleccionada !== null && semanaSeleccionada > 1 ? semanaSeleccionada - 1 : null

  const { data: sessionDataAnterior } = useQuery<SsnData>({
    queryKey: queryKeySesion(
      planificacion?.id ?? 0,
      studentId,
      hojaActiva?.id ?? 0,
      diaSeleccionado?.id ?? 0,
      semanaAnterior ?? 0
    ),
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/planificaciones/${planificacion!.id}/sesiones`, {
        params: {
          alumno_id: studentId,
          hoja_id: hojaActiva!.id,
          dia_id: diaSeleccionado!.id,
          semana: semanaAnterior,
        },
      })
      return res.data
    },
    enabled: !!planificacion && !!hojaActiva && !!diaSeleccionado && !!semanaAnterior,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  })

  const registrosAnterioresMap = useMemo(
    () => new Map((sessionDataAnterior?.registros ?? []).map((r) => [r.planificacion_ejercicio_id, r])),
    [sessionDataAnterior]
  )

  // Semana 1: pesos de la última semana de la hoja anterior, por ejercicio_id
  const { data: hojaAnteriorData } = useQuery<{ registros: Record<string, SerieRegistro & { series?: SerieRegistro[]; _semana?: number }> }>({
    queryKey: ["portalHojaAnteriorPesos", planificacion?.id ?? 0, studentId, hojaAnterior?.id ?? 0],
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/planificaciones/${planificacion!.id}/sesiones/hoja-anterior`, {
        params: { alumno_id: studentId, hoja_id: hojaAnterior!.id },
      })
      return res.data
    },
    enabled: !!planificacion && !!hojaAnterior && semanaSeleccionada === 1,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const hojaAnteriorMap = useMemo(
    () => new Map(Object.entries(hojaAnteriorData?.registros ?? {}).map(([k, v]) => [Number(k), v])),
    [hojaAnteriorData]
  )

  useEffect(() => {
    if (!diaSeleccionado || !semanaSeleccionada) {
      registrosFormRef.current = {}
      setRegistrosForm({})
      setSaltadoEjIds(new Set())
      setCheckinMostrado(false)
      dirtyEjIds.current.clear()
      pendingSerieRestoreRef.current = {}
      setPreviewPlan(false)
      return
    }

    if (justSavedRef.current) {
      justSavedRef.current = false
      return
    }

    const registrosMap = new Map(
      (sessionData?.registros ?? []).map((r) => [r.planificacion_ejercicio_id, r])
    )

    const next: Record<number, FormRow> = {}
    const saltados = new Set<number>()
    for (const ej of ejerciciosDelDia) {
      const existing = registrosMap.get(ej.id)
      const savedSeries = Array.isArray(existing?.series) && existing.series.length > 0
        ? existing.series
        : []

      // Detect skip via explicit _saltado marker (never auto-detect from all-zeros)
      const tieneMarcadorSaltado = savedSeries.length > 0 && (savedSeries[0] as any)?._saltado === true
      if (tieneMarcadorSaltado) {
        saltados.add(ej.id)
      }

      const count = clampSeries(ej.series)
      const series: SerieRow[] = Array.from({ length: count }, (_, i) => {
        const s = savedSeries[i]
        if (s) {
          return {
            peso_kg: s.peso_kg?.toString() ?? "",
            repeticiones: s.repeticiones?.toString() ?? "",
            rpe: s.rpe?.toString() ?? "",
          }
        }
        if (i === 0 && existing) {
          return {
            peso_kg: existing.peso_kg?.toString() ?? "",
            repeticiones: existing.repeticiones?.toString() ?? "",
            rpe: existing.rpe?.toString() ?? "",
          }
        }
        return { ...EMPTY_SERIE }
      })
      next[ej.id] = { series, notas: existing?.notas ?? "" }
    }
    // Overlay cualquier dato sin guardar persistido en localStorage
    let localSaltados = saltados
    if (formStorageKey) {
      try {
        const raw = localStorage.getItem(formStorageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as { form?: Record<number, FormRow>; saltados?: number[] }
          if (parsed.form) {
            for (const [ejIdStr, row] of Object.entries(parsed.form)) {
              const ejId = Number(ejIdStr)
              const localRow = row as FormRow
              const hasLocalData = (localRow.series ?? []).some((s) => s.peso_kg !== "" || s.repeticiones !== "" || s.rpe !== "") || (localRow.notas ?? "") !== ""
              if (hasLocalData) {
                next[ejId] = { series: padSeries(localRow.series, getSeriesCount(ejId)), notas: localRow.notas ?? "" }
                dirtyEjIds.current.add(ejId)
                isDirty.current = true
              }
            }
          }
          if (Array.isArray(parsed.saltados)) {
            localSaltados = new Set(parsed.saltados)
          }
        }
      } catch {}
    }
    if (!isDirty.current) {
      isDirty.current = false
      dirtyEjIds.current.clear()
    }
    registrosFormRef.current = next
    setRegistrosForm(next)
    setSaltadoEjIds(localSaltados)
    durmioMalRef.current = !!sessionData?.estado_diario?.durmio_mal
    fatigaRef.current = !!sessionData?.estado_diario?.fatiga
    desmotivacionRef.current = !!sessionData?.estado_diario?.desmotivacion
    dolorRef.current = !!sessionData?.estado_diario?.dolor
    excelenteRef.current = !!sessionData?.estado_diario?.excelente
    setDurmioMal(durmioMalRef.current)
    setFatiga(fatigaRef.current)
    setDesmotivacion(desmotivacionRef.current)
    setDolor(dolorRef.current)
    setExcelente(excelenteRef.current)
    setCheckinMostrado(sessionData?.estado_diario != null)
    setEstadoLocalDirty(false)

    // Restore scroll position after phone lock / app switch / page reload.
    // Precedence: exact window.scrollY > saved lastEjId/activeSerieMap > first-incomplete fallback.
    const storageKey = `planPos-${studentId}-${semanaSeleccionada}-${diaSeleccionado?.id}`
    const pos = readPos(storageKey)
    const savedY = typeof pos?.scrollY === "number" ? pos.scrollY : NaN
    const hasUsefulScrollY = !Number.isNaN(savedY) && savedY > 0

    const savedMap: Record<number, number> | null = pos?.activeSerieMap ?? null
    const savedLastEjId: number | null = pos?.lastEjId ?? null

    // Compute first-incomplete fallback target (used when no useful saved position)
    let fallbackEjId: number | null = null
    let fallbackSerieIdx = 0
    const hasAnyData = ejerciciosDelDia.some((ej) => {
      if (saltados.has(ej.id)) return false
      const row = next[ej.id]
      return (row?.series ?? []).some((s) => !!s.peso_kg || !!s.repeticiones || !!s.rpe)
    })
    if (hasAnyData) {
      for (const ej of ejerciciosDelDia) {
        if (saltados.has(ej.id)) continue
        const series = next[ej.id]?.series ?? []
        const incompleteIdx = series.findIndex((s) => !s.peso_kg || !s.repeticiones || !s.rpe)
        if (incompleteIdx !== -1) {
          fallbackEjId = ej.id
          fallbackSerieIdx = incompleteIdx
          break
        }
      }
    }

    // Decide what to apply
    if (hasUsefulScrollY || savedMap) {
      // Restore prior session UI position
      if (savedMap) {
        setActiveSerieMap(savedMap)
        const pending: Record<number, number> = {}
        for (const [ejIdStr, serieIdx] of Object.entries(savedMap)) {
          pending[Number(ejIdStr)] = serieIdx
        }
        pendingSerieRestoreRef.current = pending
      }
      const applyScroll = () => {
        if (hasUsefulScrollY) {
          window.scrollTo({ top: savedY, behavior: "instant" as ScrollBehavior })
        } else if (savedLastEjId != null) {
          exerciseCardRefs.current.get(savedLastEjId)?.scrollIntoView({ behavior: "instant", block: "start" })
        }
      }
      applyScroll()
      requestAnimationFrame(() => {
        applyScroll()
        requestAnimationFrame(applyScroll)
      })
    } else if (fallbackEjId !== null) {
      // Fresh session with backend data → jump to first incomplete
      const newMap = { [fallbackEjId]: fallbackSerieIdx }
      setActiveSerieMap(newMap)
      pendingSerieRestoreRef.current = { [fallbackEjId]: fallbackSerieIdx }
      const applyScroll = () => {
        exerciseCardRefs.current.get(fallbackEjId!)?.scrollIntoView({ behavior: "instant", block: "start" })
        const serieEl = serieScrollRefs.current.get(fallbackEjId!)
        if (serieEl && serieEl.clientWidth > 0) {
          serieEl.scrollLeft = fallbackSerieIdx * serieEl.clientWidth
        }
      }
      applyScroll()
      requestAnimationFrame(() => {
        applyScroll()
        requestAnimationFrame(applyScroll)
      })
    } else if (hasAnyData) {
      // Todos completos → último ej no salteado, serie 3 (la última cargada)
      const lastEj = [...ejerciciosDelDia].reverse().find((ej) => !saltados.has(ej.id))
      if (lastEj) {
        const lastSerieIdx = getSeriesCount(lastEj.id) - 1
        setActiveSerieMap({ [lastEj.id]: lastSerieIdx })
        pendingSerieRestoreRef.current = { [lastEj.id]: lastSerieIdx }
        const applyScroll = () => {
          exerciseCardRefs.current.get(lastEj.id)?.scrollIntoView({ behavior: "instant", block: "start" })
          const serieEl = serieScrollRefs.current.get(lastEj.id)
          if (serieEl && serieEl.clientWidth > 0) {
            serieEl.scrollLeft = lastSerieIdx * serieEl.clientWidth
          }
        }
        applyScroll()
        requestAnimationFrame(() => {
          applyScroll()
          requestAnimationFrame(applyScroll)
        })
      } else {
        setActiveSerieMap({})
      }
    } else {
      setActiveSerieMap({})
    }
  }, [diaSeleccionado, ejerciciosDelDia, sessionData, semanaSeleccionada])

  const allCompletedAuto = useMemo(() => {
    if (ejerciciosDelDia.length === 0) return false
    return ejerciciosDelDia.every((ej) => {
      if (saltadoEjIds.has(ej.id)) return true
      const row = registrosForm[ej.id]
      // Sin fila en el form (aún no cargó) ≠ completo: evita falsos "completado".
      if (!row) return false
      return row.series.every((s) => !!s.peso_kg && !!s.repeticiones && !!s.rpe)
    })
  }, [ejerciciosDelDia, registrosForm, saltadoEjIds])

  const allCompleted = allCompletedAuto

  const { data: sesionesSemana, refetch: _refetchSesionesSemana } = useQuery<{ sesiones: { id: number; dia_id: number; estado: string }[] }>({
    queryKey: ["portalSesionesSemana", planificacion?.id, studentId, hojaActiva?.id, semanaSeleccionada],
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/planificaciones/${planificacion!.id}/sesiones/semana`, {
        params: { alumno_id: studentId, hoja_id: hojaActiva!.id, semana: semanaSeleccionada },
      })
      return res.data
    },
    enabled: !!planificacion && !!hojaActiva && !!semanaSeleccionada && diaSeleccionadoId === null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  })

  const sesionesMapSemana = useMemo(
    () => new Map((sesionesSemana?.sesiones ?? []).map((s) => [s.dia_id, s])),
    [sesionesSemana]
  )

  const { data: sesionesResumen, refetch: _refetchResumen } = useQuery<{ sesiones: { semana: number; dia_id: number; estado: string }[] }>({
    queryKey: ["portalSesionesResumen", planificacion?.id, studentId, hojaActiva?.id],
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/planificaciones/${planificacion!.id}/sesiones/resumen`, {
        params: { alumno_id: studentId, hoja_id: hojaActiva!.id },
      })
      return res.data
    },
    enabled: !!planificacion && !!hojaActiva && semanaSeleccionada === null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  })

  // Keep refetch refs up to date
  refetchSesionesSemanaRef.current = _refetchSesionesSemana
  refetchResumenRef.current = _refetchResumen

  // Save on page close / refresh / tab hidden + autosave periódico
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty.current) {
        silentSaveRef.current = true
        flushSaveRef.current()
        e.preventDefault()
        e.returnValue = ""
      }
    }
    function handleVisibility() {
      if (document.hidden && isDirty.current && !saveIsPendingRef.current) {
        silentSaveRef.current = true
        flushSaveRef.current()
      }
    }
    function handlePageHide() {
      if (isDirty.current && !saveIsPendingRef.current) {
        silentSaveRef.current = true
        flushSaveRef.current()
      }
    }
    const autosaveInterval = setInterval(() => {
      if (isDirty.current && !saveIsPendingRef.current) {
        silentSaveRef.current = true
        flushSaveRef.current()
      }
    }, 8000)
    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("pagehide", handlePageHide)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("pagehide", handlePageHide)
      clearInterval(autosaveInterval)
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
      if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current)
      fieldIdleTimerRef.current.forEach((t) => clearTimeout(t))
      fieldIdleTimerRef.current.clear()
      setSaveStatus("idle")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // History API: push state on mount, handle back button
  useEffect(() => {
    history.pushState({ planNav: "weeks" }, "")
    if (historyDepthRef) historyDepthRef.current = 1

    function handlePopState(e: PopStateEvent) {
      if (isDirty.current) {
        silentSaveRef.current = true
        flushSaveRef.current()
      }
      if (historyDepthRef) historyDepthRef.current = Math.max(0, historyDepthRef.current - 1)
      const nav = (e.state as { planNav?: string; semana?: number } | null)
      if (nav?.planNav === "days") {
        setSemanaSeleccionada(nav.semana ?? null)
        setDiaSeleccionadoId(null)
        registrosFormRef.current = {}
        setRegistrosForm({})
        setSaltadoEjIds(new Set())
        setCheckinMostrado(false)
        setSaveMessage("")
        setSavedSuccess(false)
        isDirty.current = false
        dirtyEjIds.current.clear()
        refetchSesionesSemanaRef.current?.()
      } else if (nav?.planNav === "weeks") {
        setSemanaSeleccionada(null)
        setDiaSeleccionadoId(null)
        registrosFormRef.current = {}
        setRegistrosForm({})
        setSaltadoEjIds(new Set())
        setCheckinMostrado(false)
        setSaveMessage("")
        setSavedSuccess(false)
        isDirty.current = false
        dirtyEjIds.current.clear()
        refetchResumenRef.current?.()
      } else {
        // Cierre explícito de la planificación → no reanudar en el próximo arranque.
        try { localStorage.removeItem(`rmPlanNav-${studentId}`) } catch {}
        onRequestCloseRef.current?.()
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cold-start resume: si el SO mató la PWA (poca RAM), el estado de React y la pila de
  // history se pierden. Restaura semana/día desde localStorage y reconstruye la pila de
  // history (semanas → días → ejercicios) para que el botón Atrás siga funcionando.
  useEffect(() => {
    if (didRestoreNavRef.current) return
    if (!planificacion?.id) return
    didRestoreNavRef.current = true
    try {
      const raw = localStorage.getItem(`rmPlanNav-${studentId}`)
      if (!raw) return
      const nav = JSON.parse(raw) as { planId?: number; semana?: number; diaId?: number | null; ts?: number }
      if (!nav || nav.planId !== planificacion.id) { localStorage.removeItem(`rmPlanNav-${studentId}`); return }
      if (typeof nav.ts === "number" && Date.now() - nav.ts > POS_TTL_MS) { localStorage.removeItem(`rmPlanNav-${studentId}`); return }
      const semana = nav.semana
      if (typeof semana !== "number" || semana < 1 || semana > Math.max(1, planificacion.semanas ?? 1)) {
        localStorage.removeItem(`rmPlanNav-${studentId}`); return
      }
      const hoja = planificacion.hojas.find((h) => h.id === planificacion.hoja_activa_id) || planificacion.hojas[0] || null
      const diaId = nav.diaId
      const validDia = diaId != null && (hoja?.dias ?? []).some((d) => d.id === diaId)
      // La pila base ("weeks") ya la empujó el efecto de montaje anterior.
      history.pushState({ planNav: "days", semana }, "")
      if (validDia) history.pushState({ planNav: "exercises" }, "")
      if (historyDepthRef) historyDepthRef.current = validDia ? 3 : 2
      setSemanaSeleccionada(semana)
      if (validDia) setDiaSeleccionadoId(diaId!)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planificacion?.id, studentId])

  const semanaCompletadaMap = useMemo(() => {
    const map = new Map<number, boolean>()
    if (!sesionesResumen || !hojaActiva) return map
    const totalDias = (hojaActiva.dias ?? []).length
    if (totalDias === 0) return map
    const porSemana = new Map<number, number>()
    for (const s of sesionesResumen.sesiones) {
      if (s.estado === "completado") {
        porSemana.set(s.semana, (porSemana.get(s.semana) ?? 0) + 1)
      }
    }
    for (const [semana, count] of porSemana) {
      map.set(semana, count >= totalDias)
    }
    return map
  }, [sesionesResumen, hojaActiva])

  const saveMutation = useMutation({
    onMutate: () => {
      savingEjIdsRef.current = [...dirtyEjIds.current]
      savingEstadoRef.current = estadoDirty.current
      dirtyDuringSaveRef.current = new Set()
      estadoDirtyDuringSaveRef.current = false
      currentSaveIsSilentRef.current = silentSaveRef.current
      silentSaveRef.current = false
      if (currentSaveIsSilentRef.current) return
      setSaveStatus("saving", savingEjIdsRef.current)
    },
    mutationFn: async () => {
      if (!planificacion || !hojaActiva || !diaSeleccionado || !semanaSeleccionada) return

      const dirtyIds = new Set(dirtyEjIds.current)
      const registros: any[] = []

      for (const ej of ejerciciosDelDia) {
        if (!dirtyIds.has(ej.id)) continue

        const row = registrosFormRef.current[ej.id] ?? EMPTY_FORM_ROW(getSeriesCount(ej.id))
        const esSaltado = saltadoEjIds.has(ej.id)

        if (esSaltado) {
          const count = getSeriesCount(ej.id)
          registros.push({
            planificacion_ejercicio_id: ej.id,
            peso_kg: 0,
            repeticiones: 0,
            rpe: 0,
            notas: null,
            series: Array.from({ length: count }, (_, i) =>
              i === 0
                ? { peso_kg: 0, repeticiones: 0, rpe: 0, _saltado: true }
                : { peso_kg: 0, repeticiones: 0, rpe: 0 }
            ),
          })
          continue
        }

        const serieCompleta = row.series.some((s) => !!s.peso_kg && !!s.repeticiones && !!s.rpe)
        const hasAnyData = row.notas !== "" || serieCompleta

        if (hasAnyData) {
          // Nunca persistir valores individuales: solo series con los 3 valores (peso+reps+rpe).
          // Series parciales se mandan como null/null/null.
          const cleanSeries = row.series.map((s) => {
            const complete = !!s.peso_kg && !!s.repeticiones && !!s.rpe
            return complete
              ? { peso_kg: Number(s.peso_kg), repeticiones: Number(s.repeticiones), rpe: Number(s.rpe) }
              : { peso_kg: null, repeticiones: null, rpe: null }
          })
          registros.push({
            planificacion_ejercicio_id: ej.id,
            peso_kg: cleanSeries[0].peso_kg,
            repeticiones: cleanSeries[0].repeticiones,
            rpe: cleanSeries[0].rpe,
            notas: row.notas,
            series: cleanSeries,
          })
        } else {
          const sesionKey = queryKeySesion(planificacion.id, studentId, hojaActiva.id, diaSeleccionado.id, semanaSeleccionada)
          const cached = queryClient.getQueryData<SsnData>(sesionKey) ?? sessionData
          const priorRegistro = (cached?.registros ?? []).find((r) => r.planificacion_ejercicio_id === ej.id)
          if (priorRegistro) {
            registros.push({
              planificacion_ejercicio_id: ej.id,
              peso_kg: null,
              repeticiones: null,
              rpe: null,
              notas: null,
              series: Array.from({ length: getSeriesCount(ej.id) }, () => ({ peso_kg: null, repeticiones: null, rpe: null })),
            })
          }
        }
      }

      // client_rev monotónico: Date.now() domina entre recargas (tras un reload el ref vuelve a 0,
      // pero Date.now() es mayor a cualquier rev previo); el +1 garantiza orden estricto aunque dos
      // saves caigan en el mismo ms. El backend hace last-write-wins por client_rev.
      const clientRev = Math.max(Date.now(), clientRevRef.current + 1)
      clientRevRef.current = clientRev
      const payload: any = {
        alumno_id: studentId,
        hoja_id: hojaActiva.id,
        dia_id: diaSeleccionado.id,
        semana: semanaSeleccionada,
        estado: allCompleted ? "completado" : "abierta",
        client_rev: clientRev,
        registros,
      }
      if (estadoDirty.current) {
        payload.durmio_mal = durmioMalRef.current
        payload.fatiga = fatigaRef.current
        payload.desmotivacion = desmotivacionRef.current
        payload.dolor = dolorRef.current
        payload.excelente = excelenteRef.current
      }
      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/planificaciones/${planificacion.id}/sesiones`, payload)
    },
    onSuccess: async (_data: any) => {
      // SAVE-001: borrar SOLO lo que se envió y NO se volvió a editar durante el save in-flight.
      // El clear() ciego anterior, junto al guard `pendingResaveRef && isDirty` (con isDirty
      // forzado a false acá mismo), cancelaba el re-save de esas ediciones → pérdida de dato.
      for (const id of savingEjIdsRef.current) {
        if (!dirtyDuringSaveRef.current.has(id)) dirtyEjIds.current.delete(id)
      }
      if (savingEstadoRef.current && !estadoDirtyDuringSaveRef.current) estadoDirty.current = false
      isDirty.current = dirtyEjIds.current.size > 0 || estadoDirty.current
      // Conservar el backup local si quedó algo pendiente; solo limpiarlo cuando todo está guardado.
      if (dirtyEjIds.current.size === 0 && !estadoDirty.current) clearFormLocal()
      setSavedSuccess(true)
      setSaveMessage("")
      if (!currentSaveIsSilentRef.current) {
        setSaveStatus("saved", savingEjIdsRef.current)
        if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current)
        saveStatusResetRef.current = setTimeout(() => setSaveStatus("idle"), 2000)
      }
      if (!planificacion || !hojaActiva || !diaSeleccionado || !semanaSeleccionada) return
      justSavedRef.current = true

      const sesionKey = queryKeySesion(planificacion.id, studentId, hojaActiva.id, diaSeleccionado.id, semanaSeleccionada)

      queryClient.setQueryData<SsnData>(sesionKey, (old) => {
        if (!old) return undefined
        const registrosActualizados = (old.registros ?? []).map((r) => {
          if (saltadoEjIds.has(r.planificacion_ejercicio_id)) {
            return {
              ...r,
              peso_kg: 0,
              repeticiones: 0,
              rpe: 0,
              notas: null,
              series: Array.from({ length: getSeriesCount(r.planificacion_ejercicio_id) }, (_, i) =>
                i === 0
                  ? { peso_kg: 0, repeticiones: 0, rpe: 0, _saltado: true }
                  : { peso_kg: 0, repeticiones: 0, rpe: 0 }
              ),
            }
          }
          const formRow = registrosForm[r.planificacion_ejercicio_id]
          if (!formRow) return r
          return {
            ...r,
            peso_kg: formRow.series[0].peso_kg === "" ? null : Number(formRow.series[0].peso_kg),
            repeticiones: formRow.series[0].repeticiones === "" ? null : Number(formRow.series[0].repeticiones),
            rpe: formRow.series[0].rpe === "" ? null : Number(formRow.series[0].rpe),
            notas: formRow.notas || null,
            series: formRow.series.map((s) => ({
              peso_kg: s.peso_kg === "" ? null : Number(s.peso_kg),
              repeticiones: s.repeticiones === "" ? null : Number(s.repeticiones),
              rpe: s.rpe === "" ? null : Number(s.rpe),
            })),
          }
        })
        const sesionActualizada = old.sesion
          ? { ...old.sesion, estado: allCompleted ? "completado" : old.sesion.estado ?? "abierta" }
          : { id: 0, estado: allCompleted ? "completado" : "abierta" }
        return { ...old, sesion: sesionActualizada, estado_diario: { durmio_mal: durmioMal, fatiga, desmotivacion, dolor, excelente }, registros: registrosActualizados }
      })

      const semanaKey = ["portalSesionesSemana", planificacion.id, studentId, hojaActiva.id, semanaSeleccionada] as const
      queryClient.setQueryData<{ sesiones: { id: number; dia_id: number; estado: string }[] }>(semanaKey, (old) => {
        if (!old) return old
        const sesiones = old.sesiones.map((s) =>
          s.dia_id === diaSeleccionado.id ? { ...s, estado: allCompleted ? "completado" : s.estado } : s
        )
        if (!sesiones.find((s) => s.dia_id === diaSeleccionado.id)) {
          sesiones.push({ id: 0, dia_id: diaSeleccionado.id, estado: allCompleted ? "completado" : "abierta" })
        }
        return { sesiones }
      })

      const resumenKey = ["portalSesionesResumen", planificacion.id, studentId, hojaActiva.id] as const
      queryClient.setQueryData<{ sesiones: { semana: number; dia_id: number; estado: string }[] }>(resumenKey, (old) => {
        if (!old) return old
        const sesiones = old.sesiones.map((s) =>
          s.semana === semanaSeleccionada && s.dia_id === diaSeleccionado.id
            ? { ...s, estado: allCompleted ? "completado" : s.estado }
            : s
        )
        if (!sesiones.find((s) => s.semana === semanaSeleccionada && s.dia_id === diaSeleccionado.id)) {
          sesiones.push({ semana: semanaSeleccionada, dia_id: diaSeleccionado.id, estado: allCompleted ? "completado" : "abierta" })
        }
        return { sesiones }
      })

      queryClient.invalidateQueries({ queryKey: semanaKey })
      queryClient.invalidateQueries({ queryKey: resumenKey })

      // Reenviar si quedó algo pendiente (ediciones in-flight o estado re-tocado).
      if (pendingResaveRef.current || dirtyEjIds.current.size > 0 || estadoDirty.current) {
        pendingResaveRef.current = false
        saveMutateRef.current()
      }
    },
    onError: () => {
      setSaveMessage("No se pudo guardar")
      if (!currentSaveIsSilentRef.current) {
        setSaveStatus("error", savingEjIdsRef.current)
        if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current)
        saveStatusResetRef.current = setTimeout(() => setSaveStatus("idle"), 3000)
      }
    },
  })

  const saveMutateRef = useRef(saveMutation.mutate)
  saveMutateRef.current = saveMutation.mutate
  const saveIsPendingRef = useRef(saveMutation.isPending)
  saveIsPendingRef.current = saveMutation.isPending

  // Envío inmediato (cancela cualquier debounce pendiente). Si ya hay un save in-flight, encola
  // un re-save en vez de disparar un PUT concurrente. No envía nada si no quedó trabajo sucio.
  const flushSave = () => {
    if (saveDebounceRef.current) { clearTimeout(saveDebounceRef.current); saveDebounceRef.current = null }
    if (dirtyEjIds.current.size === 0 && !estadoDirty.current) return
    if (saveIsPendingRef.current) { pendingResaveRef.current = true; return }
    saveMutateRef.current()
  }
  const flushSaveRef = useRef(flushSave)
  flushSaveRef.current = flushSave
  // Envío debounced: coalesce múltiples series completadas en un solo PUT.
  const scheduleSave = () => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      saveDebounceRef.current = null
      flushSaveRef.current()
    }, SAVE_DEBOUNCE_MS)
  }

  // Self-heal: sesiones que quedaron "abierta" en DB pese a tener todos los ejercicios
  // completos (p.ej. guardadas por un bundle viejo que contaba los accesorios/activadores
  // como completables). Al abrir el día con todo completo y sin ediciones pendientes,
  // re-envía el estado en un save silencioso (sin registros dirty, el RPC solo avanza estado).
  const selfHealKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!sessionData?.sesion || sessionData.sesion.estado === "completado") return
    if (!allCompletedAuto) return
    if (isDirty.current || saveIsPendingRef.current) return
    const key = `${diaSeleccionado?.id}-${semanaSeleccionada}`
    if (selfHealKeyRef.current === key) return
    selfHealKeyRef.current = key
    silentSaveRef.current = true
    saveMutateRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData, allCompletedAuto, diaSeleccionado?.id, semanaSeleccionada])


  const handleSerieChange = (planEjId: number, serieIdx: number, field: keyof SerieRow, value: string) => {
    const clamped = clampSerieValue(field, value)
    isDirty.current = true
    dirtyEjIds.current.add(planEjId)
    if (saveIsPendingRef.current) dirtyDuringSaveRef.current.add(planEjId)
    setSaveMessage("")
    setSavedSuccess(false)

    const old = registrosFormRef.current[planEjId] ?? EMPTY_FORM_ROW(getSeriesCount(planEjId))
    const newSeries = old.series.map((s, i) =>
      i === serieIdx ? { ...s, [field]: clamped } : s
    )
    const updated = { ...registrosFormRef.current, [planEjId]: { ...old, series: newSeries } }
    registrosFormRef.current = updated
    setRegistrosForm(updated)
    persistFormLocal(updated, saltadoEjIds)

    const oldSerie = old.series[serieIdx]
    const thisSerie = newSeries[serieIdx]
    const serieFilled = !!thisSerie.peso_kg && !!thisSerie.repeticiones && !!thisSerie.rpe
    const serieEmpty = !thisSerie.peso_kg && !thisSerie.repeticiones && !thisSerie.rpe
    const wasNotEmpty = !!oldSerie.peso_kg || !!oldSerie.repeticiones || !!oldSerie.rpe
    const shouldSave = serieFilled || (serieEmpty && wasNotEmpty)

    // Idle por-input (pendiente 11): 3s sin escribir en este input → saltar al próximo campo
    // de la misma serie (peso→reps→rpe). El cambio de serie lo maneja el advance de serie-llena.
    const fields: (keyof SerieRow)[] = ["peso_kg", "repeticiones", "rpe"]
    const fieldIdx = fields.indexOf(field)
    const idleKey = `${planEjId}-${serieIdx}-${field}`
    const pendingIdle = fieldIdleTimerRef.current.get(idleKey)
    if (pendingIdle) clearTimeout(pendingIdle)
    if (clamped !== "" && fieldIdx < fields.length - 1 && !serieFilled) {
      const idle = setTimeout(() => {
        fieldIdleTimerRef.current.delete(idleKey)
        const current = inputRefs.current.get(idleKey)
        // solo saltar si el usuario sigue parado en este input (no robar foco si ya navegó)
        if (current && document.activeElement !== current) {
          console.log(`[idle] ${idleKey}: foco ya movido, no salto`)
          return
        }
        console.log(`[idle] ${idleKey} → ${fields[fieldIdx + 1]} (${FIELD_IDLE_MS}ms sin escribir)`)
        inputRefs.current.get(`${planEjId}-${serieIdx}-${fields[fieldIdx + 1]}`)?.focus()
      }, FIELD_IDLE_MS)
      fieldIdleTimerRef.current.set(idleKey, idle)
    }

    const advanceKey = `${planEjId}-${serieIdx}`
    const pending = serieAdvanceDebounceRef.current.get(advanceKey)
    if (pending) clearTimeout(pending)

    if (serieFilled) {
      const t = setTimeout(() => {
        serieAdvanceDebounceRef.current.delete(advanceKey)
        if (serieIdx < getSeriesCount(planEjId) - 1) {
          // serie completa → scroll + foco al peso de la próxima serie
          scrollToSerie(planEjId, serieIdx + 1)
          console.log(`[idle] serie ${planEjId}-${serieIdx} completa → peso serie ${serieIdx + 1}`)
          inputRefs.current.get(`${planEjId}-${serieIdx + 1}-peso_kg`)?.focus()
        } else {
          // última serie del ejercicio → scroll + foco al peso de la 1ª serie del próximo
          const ejIdx = ejerciciosDelDia.findIndex((e) => e.id === planEjId)
          if (ejIdx !== -1 && ejIdx < ejerciciosDelDia.length - 1) {
            const nextEjId = ejerciciosDelDia[ejIdx + 1].id
            exerciseCardRefs.current.get(nextEjId)?.scrollIntoView({ behavior: "smooth", block: "start" })
            console.log(`[idle] ejercicio ${planEjId} completo → peso serie 0 de ${nextEjId}`)
            inputRefs.current.get(`${nextEjId}-0-peso_kg`)?.focus()
          }
        }
      }, FIELD_IDLE_MS)
      serieAdvanceDebounceRef.current.set(advanceKey, t)
    }

    if (shouldSave) scheduleSave()
  }

  const handleToggleEstado = (field: "durmioMal" | "fatiga" | "desmotivacion" | "dolor" | "excelente") => {
    const setters = { durmioMal: setDurmioMal, fatiga: setFatiga, desmotivacion: setDesmotivacion, dolor: setDolor, excelente: setExcelente }
    const refs = { durmioMal: durmioMalRef, fatiga: fatigaRef, desmotivacion: desmotivacionRef, dolor: dolorRef, excelente: excelenteRef }
    refs[field].current = !refs[field].current
    setters[field](refs[field].current)
    isDirty.current = true
    estadoDirty.current = true
    if (saveIsPendingRef.current) estadoDirtyDuringSaveRef.current = true
    setEstadoLocalDirty(true)
  }

  const handleEstoyPerfecto = () => {
    durmioMalRef.current = false
    fatigaRef.current = false
    desmotivacionRef.current = false
    dolorRef.current = false
    excelenteRef.current = true
    setDurmioMal(false)
    setFatiga(false)
    setDesmotivacion(false)
    setDolor(false)
    setExcelente(true)
    setCheckinMostrado(true)
    setEstadoLocalDirty(false)
    isDirty.current = true
    estadoDirty.current = true
    silentSaveRef.current = true
    if (saveIsPendingRef.current) estadoDirtyDuringSaveRef.current = true
    flushSave()
  }

  const handleConfirmar = () => {
    excelenteRef.current = false
    setExcelente(false)
    setCheckinMostrado(true)
    setEstadoLocalDirty(false)
    isDirty.current = true
    estadoDirty.current = true
    silentSaveRef.current = true
    if (saveIsPendingRef.current) estadoDirtyDuringSaveRef.current = true
    flushSave()
  }

  const handleNotasChange = (planEjId: number, value: string) => {
    isDirty.current = true
    setSaveMessage("")
    setSavedSuccess(false)
    const old = registrosFormRef.current[planEjId] ?? EMPTY_FORM_ROW(getSeriesCount(planEjId))
    const updated = { ...registrosFormRef.current, [planEjId]: { ...old, notas: value } }
    registrosFormRef.current = updated
    setRegistrosForm(updated)
    dirtyEjIds.current.add(planEjId)
    if (saveIsPendingRef.current) dirtyDuringSaveRef.current.add(planEjId)
  }

  const handleToggleSkip = (planEjId: number) => {
    isDirty.current = true
    setSaveMessage("")
    setSavedSuccess(false)
    const newSaltados = new Set(saltadoEjIds)
    if (newSaltados.has(planEjId)) newSaltados.delete(planEjId)
    else newSaltados.add(planEjId)
    setSaltadoEjIds(newSaltados)
    const updatedSkip = { ...registrosFormRef.current, [planEjId]: EMPTY_FORM_ROW(getSeriesCount(planEjId)) }
    registrosFormRef.current = updatedSkip
    setRegistrosForm(updatedSkip)
    persistFormLocal(updatedSkip, newSaltados)
    dirtyEjIds.current.add(planEjId)
    silentSaveRef.current = true
    if (saveIsPendingRef.current) dirtyDuringSaveRef.current.add(planEjId)
    flushSave()
  }

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          <p className="text-xs text-muted-foreground dark:text-zinc-500">Cargando tu planificación…</p>
        </div>
      </div>
    )
  }

  if (errorPlan) {
    return (
      <div className="rounded-2xl border border-border dark:border-white/[0.06] bg-muted/40 dark:bg-white/[0.03] p-6 text-center">
        <p className="text-sm text-muted-foreground dark:text-zinc-400">No pudimos cargar tu planificación.</p>
      </div>
    )
  }

  if (!planificacion) {
    return (
      <div className="rounded-2xl border border-border dark:border-white/[0.06] bg-muted/40 dark:bg-white/[0.03] p-8 text-center space-y-3">
        <div className="h-12 w-12 rounded-xl bg-muted dark:bg-zinc-800 flex items-center justify-center mx-auto">
          <Dumbbell className="h-6 w-6 text-muted-foreground dark:text-zinc-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground/90 dark:text-zinc-300">Sin planificación asignada</p>
          <p className="text-xs text-muted-foreground dark:text-zinc-500 mt-1">Tu entrenador aún no te asignó un plan.</p>
        </div>
      </div>
    )
  }

  /* ── Semana selection ── */
  if (semanaSeleccionada === null) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Trophy className="h-3.5 w-3.5 text-green-400" />
            </div>
            <h2 className="text-base font-bold text-foreground dark:text-white">{planificacion.nombre}</h2>
          </div>
          <p className="text-xs text-muted-foreground dark:text-zinc-500 pl-9">{totalSemanas} semanas · {hojaActiva?.nombre}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground dark:text-zinc-500 mb-3">Seleccioná una semana</p>
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: totalSemanas }, (_, i) => i + 1).map((semana) => {
              const completada = semanaCompletadaMap.get(semana) === true
              return (
                <button
                  key={semana}
                  onClick={() => {
                    history.pushState({ planNav: "days", semana }, "")
                    if (historyDepthRef) historyDepthRef.current++
                    setSemanaSeleccionada(semana)
                  }}
                  className={`group relative aspect-square rounded-2xl border active:scale-95 transition-all duration-150 p-4 text-left overflow-hidden shadow-sm dark:shadow-none ${
                    completada
                      ? "border-green-500 dark:border-green-500/40 bg-green-100 dark:bg-green-500/[0.07] hover:bg-green-200 dark:hover:bg-green-500/[0.11]"
                      : "border-border bg-card dark:bg-white/[0.03] hover:bg-muted dark:hover:bg-white/[0.06] hover:border-green-500/60 dark:hover:border-green-500/30 active:bg-green-200 dark:active:bg-green-500/20 active:border-green-500"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 group-hover:from-green-500/5 to-transparent transition-all duration-200" />
                  <span className={`absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-widest transition-colors ${completada ? "text-green-500/70" : "text-muted-foreground dark:text-zinc-500 group-hover:text-green-500/70"}`}>Semana</span>
                  <span className={`absolute inset-0 flex items-center justify-center text-4xl font-black transition-colors ${completada ? "text-green-700 dark:text-green-400" : "text-foreground dark:text-white"}`}>{semana}</span>
                  {completada
                    ? <CheckCircle2 className="absolute right-3 bottom-3 h-4 w-4 text-green-600 dark:text-green-400" />
                    : <ChevronRight className="absolute right-3 bottom-3 h-4 w-4 text-muted-foreground/70 dark:text-zinc-600 group-hover:text-green-500/50 transition-colors" />
                  }
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  /* ── Día selection ── */
  if (diaSeleccionadoId === null) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => history.back()}
            className="h-8 w-8 rounded-xl bg-muted/50 dark:bg-white/[0.05] hover:bg-muted/70 dark:bg-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground dark:text-zinc-400" />
          </button>
          <div>
            <p className="text-xs text-muted-foreground dark:text-zinc-500">Semana {semanaSeleccionada}</p>
            <p className="text-sm font-bold text-foreground dark:text-white leading-tight">Elegí un día</p>
          </div>
        </div>

        {dias.length === 0 ? (
          <p className="text-sm text-muted-foreground dark:text-zinc-400 text-center py-8">Esta hoja no tiene días cargados.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {dias.map((dia) => {
              const completado = sesionesMapSemana.get(dia.id)?.estado === "completado"
              return (
                <button
                  key={dia.id}
                  onClick={() => {
                    history.pushState({ planNav: "exercises" }, "")
                    if (historyDepthRef) historyDepthRef.current++
                    setDiaSeleccionadoId(dia.id)
                  }}
                  className={`group relative aspect-square rounded-2xl border active:scale-95 transition-all duration-150 p-4 text-left overflow-hidden ${
                    completado
                      ? "border-green-500/40 bg-green-500/[0.07] hover:bg-green-500/[0.11]"
                      : "border-border dark:border-white/[0.07] bg-muted/40 dark:bg-white/[0.03] hover:bg-muted/60 dark:bg-white/[0.06] hover:border-green-500/30 active:bg-green-500/20 active:border-green-500/60"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 group-hover:from-green-500/5 to-transparent transition-all duration-200" />
                  <span className={`absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-widest transition-colors ${completado ? "text-green-500/70" : "text-muted-foreground dark:text-zinc-500 group-hover:text-green-500/70"}`}>Día</span>
                  <span className={`absolute inset-0 flex items-center justify-center text-4xl font-black transition-colors ${completado ? "text-green-700 dark:text-green-400" : "text-foreground dark:text-white"}`}>{dia.numero_dia}</span>
                  <span className="absolute bottom-3 left-3 right-8 text-[10px] text-muted-foreground dark:text-zinc-400 truncate">{dia.nombre}</span>
                  {completado
                    ? <CheckCircle2 className="absolute right-3 bottom-3 h-4 w-4 text-green-600 dark:text-green-400" />
                    : <ChevronRight className="absolute right-3 bottom-3 h-4 w-4 text-muted-foreground/70 dark:text-zinc-600 group-hover:text-green-500/50 transition-colors" />
                  }
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /* ── Exercises ── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { if (previewPlan) setPreviewPlan(false); else history.back() }}
          className="h-8 w-8 rounded-xl bg-muted/50 dark:bg-white/[0.05] hover:bg-muted/70 dark:bg-white/[0.08] flex items-center justify-center transition-colors flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground dark:text-zinc-400" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground dark:text-zinc-500">
            {previewPlan ? "Vista previa · " : ""}Semana {semanaSeleccionada}
          </p>
          <p className="text-base font-bold text-foreground dark:text-white leading-tight truncate">
            Día {diaSeleccionado?.numero_dia} · {diaSeleccionado?.nombre}
          </p>
        </div>
        {loadingSession
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground dark:text-zinc-500 flex-shrink-0" />
          : (allCompleted && !previewPlan) ? (
            <span className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold border bg-green-500/15 border-green-500/30 text-green-400 flex-shrink-0">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              Completado
            </span>
          ) : null
        }
      </div>

      {loadingSession ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground dark:text-zinc-500" />
        </div>
      ) : (!checkinMostrado && !previewPlan) ? (
        /* ── Check-in inicial ── */
        <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 py-4 pb-24 relative">
          <div className="w-full flex flex-col items-center gap-5">
          <div className="text-center space-y-1 mb-2">
            <p className="text-xl font-bold text-white">¿Cómo estás hoy?</p>
            <p className="text-sm text-white/70">Seleccioná lo que corresponda</p>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            <button
              onClick={() => handleToggleEstado("durmioMal")}
              className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl text-sm font-bold border transition-all ${
                durmioMal
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                  : "bg-muted/40 dark:bg-white/[0.03] border-border dark:border-white/[0.06] text-muted-foreground dark:text-zinc-500 hover:border-indigo-500/20 hover:text-foreground/90 dark:text-zinc-300"
              }`}
            >
              <Moon className="h-7 w-7" />
              Dormí mal
            </button>
            <button
              onClick={() => handleToggleEstado("fatiga")}
              className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl text-sm font-bold border transition-all ${
                fatiga
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-muted/40 dark:bg-white/[0.03] border-border dark:border-white/[0.06] text-muted-foreground dark:text-zinc-500 hover:border-amber-500/20 hover:text-foreground/90 dark:text-zinc-300"
              }`}
            >
              <BatteryWarning className="h-7 w-7" />
              Mucha fatiga
            </button>
            <button
              onClick={() => handleToggleEstado("desmotivacion")}
              className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl text-sm font-bold border transition-all ${
                desmotivacion
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                  : "bg-muted/40 dark:bg-white/[0.03] border-border dark:border-white/[0.06] text-muted-foreground dark:text-zinc-500 hover:border-cyan-500/20 hover:text-foreground/90 dark:text-zinc-300"
              }`}
            >
              <Frown className="h-7 w-7" />
              Poca motivación
            </button>
            <button
              onClick={() => handleToggleEstado("dolor")}
              className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl text-sm font-bold border transition-all ${
                dolor
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                  : "bg-muted/40 dark:bg-white/[0.03] border-border dark:border-white/[0.06] text-muted-foreground dark:text-zinc-500 hover:border-rose-500/20 hover:text-foreground/90 dark:text-zinc-300"
              }`}
            >
              <Activity className="h-7 w-7" />
              Dolor muscular
            </button>
          </div>

          <button
            onClick={durmioMal || fatiga || desmotivacion || dolor ? handleConfirmar : handleEstoyPerfecto}
            className="w-full max-w-sm py-4 rounded-2xl bg-green-500/15 border border-green-500/30 text-green-400 text-base font-bold hover:bg-green-500/20 transition-all active:scale-[0.98]"
          >
            {durmioMal || fatiga || desmotivacion || dolor ? "Confirmar" : "¡Estoy excelente!"}
          </button>
          </div>

          <button
            onClick={() => setPreviewPlan(true)}
            className="absolute bottom-4 left-4 right-4 mx-auto max-w-sm py-3.5 rounded-2xl bg-transparent border border-sky-500/30 text-sky-400 text-sm font-bold hover:bg-sky-500/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Eye className="h-5 w-5" />
            Ver planificación del día
          </button>
        </div>
      ) : (
        <>
          {/* Estado de salud */}
          {!previewPlan && !excelente && (
          <div className="space-y-2">
            <div className={`grid gap-1.5 ${(durmioMal || fatiga || desmotivacion || dolor) ? "grid-cols-4" : "grid-cols-5"}`}>
              {([
                { field: "excelente" as const, label: "Excelente", Icon: CheckCircle2, active: excelente, on: "bg-green-500/20 border-green-500/40 text-green-300" },
                { field: "durmioMal" as const, label: "Sueño", Icon: Moon, active: durmioMal, on: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" },
                { field: "fatiga" as const, label: "Fatiga", Icon: BatteryWarning, active: fatiga, on: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
                { field: "desmotivacion" as const, label: "Ánimo", Icon: Frown, active: desmotivacion, on: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" },
                { field: "dolor" as const, label: "Dolor", Icon: Activity, active: dolor, on: "bg-rose-500/20 border-rose-500/40 text-rose-300" },
              ])
                .filter(({ field }) => {
                  if (durmioMal || fatiga || desmotivacion || dolor) return field !== "excelente"
                  return true
                })
                .map(({ field, label, Icon, active, on }) => (
                <button
                  key={field}
                  onClick={() => handleToggleEstado(field)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 ${
                    active ? on : "bg-muted/40 dark:bg-white/[0.03] border-border dark:border-white/[0.06] text-muted-foreground/70 dark:text-zinc-600 hover:text-muted-foreground dark:text-zinc-400 hover:border-border dark:border-white/[0.1]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-semibold">{label}</span>
                </button>
              ))}
            </div>
            {estadoLocalDirty && (
              <div className="animate-in slide-in-from-top-3 fade-in duration-200">
                <button
                  onClick={() => {
                    estadoDirty.current = true
                    isDirty.current = true
                    if (saveIsPendingRef.current) estadoDirtyDuringSaveRef.current = true
                    flushSave()
                    setEstadoLocalDirty(false)
                  }}
                  disabled={saveMutation.isPending}
                  className="w-full py-2.5 rounded-2xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold hover:bg-green-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</>
                    : <><CheckCircle2 className="h-3.5 w-3.5" /> Guardar estado de salud</>
                  }
                </button>
              </div>
            )}
          </div>
          )}

          {/* Movilidad */}
          {(hojaActiva?.movilidad ?? []).length > 0 && (() => {
            const movilidad = hojaActiva!.movilidad
            const total = movilidad.length
            const mov = movilidad[movilidadIdx]
            return (
              <div className="!mt-12 rounded-2xl border border-border dark:border-white/[0.07] bg-muted/30 dark:bg-white/[0.02]">
                {/* Header */}
                <div className="px-4 pt-3 pb-2 border-b border-border dark:border-white/[0.05]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-amber-400 flex-shrink-0">Movilidad</span>
                    <span className="text-xs font-semibold text-muted-foreground dark:text-zinc-500 flex-shrink-0">{movilidadIdx + 1}/{total}</span>
                  </div>
                  <p className="text-base font-bold text-foreground dark:text-zinc-200 leading-snug mt-1">{mov.nombre}</p>
                </div>

                {/* Scroll carousel */}
                <div
                  ref={movilidadScrollRef}
                  className="flex overflow-x-auto snap-x snap-mandatory pt-4 pb-2"
                  style={{ scrollbarWidth: "none" }}
                  onScroll={(e) => {
                    const idx = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth)
                    setMovilidadIdx(idx)
                  }}
                >
                  {movilidad.map((item, i) => (
                    <div key={item.id} className="snap-start flex-shrink-0 w-full px-4">
                      <div
                        className={`relative w-full ${item.video_url ? "cursor-pointer" : ""}`}
                        onClick={item.video_url ? () => setVideoModal({ nombre: item.nombre, url: item.video_url! }) : undefined}
                        role={item.video_url ? "button" : undefined}
                        tabIndex={item.video_url ? 0 : undefined}
                        onKeyDown={item.video_url ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVideoModal({ nombre: item.nombre, url: item.video_url! }) } } : undefined}
                        aria-label={item.video_url ? `Ver video de ${item.nombre}` : undefined}
                      >
                        {item.imagen_url ? (
                          <img
                            src={item.imagen_url}
                            alt={item.nombre}
                            className="w-full aspect-video rounded-xl object-cover bg-muted dark:bg-zinc-800"
                          />
                        ) : (
                          <div className="w-full aspect-video rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <span className="text-5xl font-black text-amber-400">{i + 1}</span>
                          </div>
                        )}
                        {item.video_url && (
                          <span className="pointer-events-none absolute top-2 left-2 h-9 w-9 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-md">
                            <Play className="h-4 w-4" fill="currentColor" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dots */}
                {total > 1 && (
                  <div className="flex justify-center gap-1.5 pb-3">
                    {movilidad.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setMovilidadIdx(i)
                          movilidadScrollRef.current?.scrollTo({ left: i * movilidadScrollRef.current.clientWidth, behavior: "smooth" })
                        }}
                        className={`rounded-full transition-all ${
                          i === movilidadIdx ? "w-4 h-1.5 bg-amber-400" : "w-1.5 h-1.5 bg-muted-foreground/40 dark:bg-zinc-600"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Accesorios (activadores) — solo vista, no se completan */}
          {accesorios.length > 0 && (
            <div className="!mb-12 rounded-2xl border border-yellow-500/25 dark:border-yellow-500/15 bg-yellow-500/[0.05] dark:bg-yellow-500/[0.03] overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-yellow-500/20 dark:border-white/[0.05]">
                <span className="text-xs font-black uppercase tracking-widest text-yellow-600 dark:text-yellow-300">Accesorios</span>
              </div>
              <div className="flex flex-col divide-y divide-border dark:divide-white/[0.05]">
                {accesorios.map((ej) => {
                  const semPlan = ej.semanas.find((s) => s.semana === semanaSeleccionada)
                  const semPlanPrev = semanaSeleccionada != null && semanaSeleccionada % 2 === 0
                    ? ej.semanas.find((s) => s.semana === semanaSeleccionada - 1)
                    : undefined
                  const dosis = semPlan?.dosis ?? semPlanPrev?.dosis ?? null
                  const rpe = semPlan?.rpe ?? semPlanPrev?.rpe ?? null
                  return (
                    <div key={ej.id} className="flex items-center gap-2.5 px-4 py-3">
                      <p className="flex-1 min-w-0 text-base font-bold text-foreground dark:text-white leading-snug">
                        {ej.ejercicios?.nombre ?? "Ejercicio"}
                      </p>
                      {dosis && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 dark:bg-blue-500/15 border border-blue-400/60 dark:border-blue-500/30 px-2.5 py-1 text-sm font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                          <Repeat className="h-4 w-4" />
                          {dosis}
                        </span>
                      )}
                      {typeof rpe === "number" && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-orange-100 dark:bg-orange-500/15 border border-orange-400/60 dark:border-orange-500/30 px-2.5 py-1 text-sm font-bold text-orange-700 dark:text-orange-300 flex-shrink-0">
                          <Flame className="h-4 w-4" />
                          {rpe}
                        </span>
                      )}
                      {ej.ejercicios?.video_url && (
                        <button
                          onClick={() => setVideoModal({ nombre: ej.ejercicios!.nombre, url: ej.ejercicios!.video_url! })}
                          className="h-8 w-8 rounded-full bg-amber-400 text-black flex items-center justify-center flex-shrink-0 shadow-md transition-opacity hover:opacity-80"
                        >
                          <Play className="h-3.5 w-3.5" fill="currentColor" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Exercise cards */}
          {ejerciciosDelDia.length === 0 ? (
            <p className="text-sm text-muted-foreground dark:text-zinc-400 text-center py-8">Este día no tiene ejercicios asignados.</p>
          ) : (
            <div className="space-y-6">
              {ejerciciosDelDia.map((ej) => {
            const semanaPlan = ej.semanas.find((s) => s.semana === semanaSeleccionada)
            const semanaPlanPrev = semanaSeleccionada != null && semanaSeleccionada % 2 === 0
              ? ej.semanas.find((s) => s.semana === semanaSeleccionada - 1)
              : undefined
            const effectiveRpe = semanaPlan?.rpe ?? semanaPlanPrev?.rpe ?? null
            const effectiveDosis = semanaPlan?.dosis ?? semanaPlanPrev?.dosis ?? null
            const effectiveNota = semanaPlan?.notas_profesor ?? semanaPlanPrev?.notas_profesor ?? null
            const seriesCount = clampSeries(ej.series)
            const row = registrosForm[ej.id] ?? EMPTY_FORM_ROW(seriesCount)
            const isFilled = row.series.length > 0 && row.series.every((s) => !!s.peso_kg && !!s.repeticiones && !!s.rpe)
            // Semana 1 → última semana del bloque anterior (match por ejercicio_id). Sem>1 → semana previa (match por planificacion_ejercicio_id)
            const regAnterior = (semanaSeleccionada === 1
              ? hojaAnteriorMap.get(ej.ejercicios?.id ?? -1)
              : registrosAnterioresMap.get(ej.id)) ?? null
            const mostrarAnterior = semanaSeleccionada === 1 ? !!hojaAnterior : !!semanaAnterior
            const anteriorLabelPrefix = semanaSeleccionada === 1 ? "Bloque anterior" : `Semana ${semanaAnterior}`
            const anteriorSeries: SerieRegistro[] | null = (() => {
              if (!regAnterior) return null
              if (Array.isArray(regAnterior.series) && regAnterior.series.length > 0) return regAnterior.series
              // fallback: registros guardados con formato anterior (campos top-level)
              if (regAnterior.peso_kg !== null || regAnterior.repeticiones !== null || regAnterior.rpe !== null) {
                return [{ peso_kg: regAnterior.peso_kg, repeticiones: regAnterior.repeticiones, rpe: regAnterior.rpe }]
              }
              return null
            })()
            const catStyle = CATEGORIA_ROW_STYLE[ej.categoria] ?? {}
            const catColor = catStyle.color as string | undefined
            const catBg = catStyle.backgroundColor as string | undefined
            const esSaltado = saltadoEjIds.has(ej.id)

            return (
              <div
                key={ej.id}
                data-ej-id={ej.id}
                ref={(el) => { if (el) exerciseCardRefs.current.set(ej.id, el) }}
                className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
                  esSaltado
                    ? "border-amber-500/20 opacity-60"
                    : "border-border dark:border-white/[0.07]"
                }`}
              >
                {/* Category + name + video strip */}
                <div
                  className="px-4 py-3 rounded-t-2xl flex items-center gap-2"
                  style={{ backgroundColor: catBg ? `color-mix(in srgb, ${catBg} 60%, transparent)` : undefined }}
                >
                  {/* Categoría (izq) */}
                  <span
                    className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-md flex-shrink-0"
                    style={{ color: catColor, backgroundColor: catBg }}
                  >
                    {ej.categoria}
                  </span>
                  {/* Nombre centrado en el medio */}
                  <p className="flex-1 min-w-0 text-lg font-bold text-foreground dark:text-white leading-snug text-center">
                    {ej.ejercicios?.nombre ?? "Ejercicio"}
                  </p>
                  {/* Video + guardado (der) */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!previewPlan && <CardSaveBadge ejId={ej.id} />}
                    {ej.ejercicios?.video_url && (
                      <button
                        onClick={() => setVideoModal({ nombre: ej.ejercicios!.nombre, url: ej.ejercicios!.video_url! })}
                        className="h-9 w-9 rounded-full bg-amber-400 text-black flex items-center justify-center flex-shrink-0 shadow-md transition-opacity hover:opacity-80"
                      >
                        <Play className="h-4 w-4" fill="currentColor" />
                      </button>
                    )}
                  </div>
                </div>

                {effectiveNota && (
                  <div className="px-4 pt-2">
                    <div className="rounded-xl border border-violet-400 dark:border-violet-500/20 bg-violet-100 dark:bg-violet-500/[0.08] px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400 mb-1">Nota del profesor · Semana {semanaSeleccionada}</p>
                      <p className="text-sm text-foreground dark:text-zinc-200 whitespace-pre-wrap">{effectiveNota}</p>
                    </div>
                  </div>
                )}

                {/* Dosis / RPE prescrito — 50/50 */}
                {(effectiveDosis || typeof effectiveRpe === "number") && (
                  <div className="px-4 pt-14 pb-0 grid grid-cols-2 gap-2">
                    {effectiveDosis ? (
                      <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-100 dark:bg-blue-500/15 border border-blue-400 dark:border-blue-500/30 px-4 py-3.5 text-lg font-extrabold text-blue-700 dark:text-blue-300">
                        <Repeat className="h-6 w-6" />
                        {effectiveDosis}
                      </span>
                    ) : <div />}
                    {typeof effectiveRpe === "number" ? (
                      <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-100 dark:bg-orange-500/15 border border-orange-400 dark:border-orange-500/30 px-4 py-3.5 text-lg font-extrabold text-orange-700 dark:text-orange-300">
                        <Flame className="h-6 w-6" />
                        RPE {effectiveRpe}
                      </span>
                    ) : <div />}
                  </div>
                )}

                {/* Serie pills + scroll (oculto en modo solo lectura) */}
                {previewPlan ? (
                  <div className="pb-3" />
                ) : (
                <div className="pb-4">
                  {/* Pills de series (cantidad definida por el profesor) */}
                  <div className="grid gap-2 px-4 mt-14 mb-3" style={{ gridTemplateColumns: `repeat(${Math.min(seriesCount, 4)}, minmax(0, 1fr))` }}>
                    {Array.from({ length: seriesCount }, (_, i) => {
                      const s = row.series[i] ?? EMPTY_SERIE
                      const filled = !!s.peso_kg && !!s.repeticiones && !!s.rpe
                      const active = getActiveSerie(ej.id) === i
                      return (
                        <button
                          key={i}
                          onClick={() => scrollToSerie(ej.id, i)}
                          className={`relative flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold transition-all border ${
                            active
                              ? "bg-muted dark:bg-white/[0.12] border-green-400/60 text-foreground dark:text-white shadow-[0_0_12px_rgba(74,222,128,0.25)] scale-[1.03] z-10"
                              : filled
                              ? "bg-green-500/15 border-green-500/30 text-foreground/80 dark:text-foreground dark:text-white/80"
                              : "bg-transparent border-border dark:border-white/[0.05] text-muted-foreground/70 dark:text-zinc-600"
                          }`}
                        >
                          Serie {i + 1}
                          {filled && (
                            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${active ? "bg-green-300" : "bg-green-500"}`} />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Horizontal scroll container */}
                  <div
                    ref={(el) => {
                      if (el) {
                        serieScrollRefs.current.set(ej.id, el)
                        const pending = pendingSerieRestoreRef.current[ej.id]
                        if (pending != null) {
                          el.scrollLeft = pending * el.clientWidth
                          delete pendingSerieRestoreRef.current[ej.id]
                        }
                      }
                    }}
                    className="flex overflow-x-auto snap-x snap-mandatory"
                    style={{ scrollbarWidth: "none" }}
                    onScroll={(e) => handleSerieScroll(ej.id, e.currentTarget)}
                  >
                    {Array.from({ length: seriesCount }, (_, serieIdx) => {
                      const serie = row.series[serieIdx] ?? EMPTY_SERIE
                      const anteriorSerie = anteriorSeries?.[serieIdx] ?? null
                      return (
                        <div key={serieIdx} className="snap-start flex-shrink-0 w-full px-4 space-y-3">
                          {/* 3-col grid: peso / reps / rpe */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1.5">
                              <label className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
                                <Weight className="h-3.5 w-3.5" />
                                Peso kg
                              </label>
                              <Input
                                ref={(el) => { if (el) inputRefs.current.set(`${ej.id}-${serieIdx}-peso_kg`, el) }}
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={serie.peso_kg}
                                onChange={(e) => handleSerieChange(ej.id, serieIdx, "peso_kg", e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextInput(ej.id, serieIdx, "peso_kg") } }}
                                className="bg-card/80 dark:bg-zinc-900/80 border-border dark:border-white/[0.08] focus:border-green-500/50 focus:ring-green-500/20 text-foreground dark:text-white placeholder:text-foreground/60 dark:placeholder:text-zinc-300 h-14 text-xl font-bold text-center rounded-xl"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reps
                              </label>
                              <Input
                                ref={(el) => { if (el) inputRefs.current.set(`${ej.id}-${serieIdx}-repeticiones`, el) }}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                value={serie.repeticiones}
                                onChange={(e) => handleSerieChange(ej.id, serieIdx, "repeticiones", e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextInput(ej.id, serieIdx, "repeticiones") } }}
                                className="bg-card/80 dark:bg-zinc-900/80 border-border dark:border-white/[0.08] focus:border-green-500/50 focus:ring-green-500/20 text-foreground dark:text-white placeholder:text-foreground/60 dark:placeholder:text-zinc-300 h-14 text-xl font-bold text-center rounded-xl"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
                                <Flame className="h-3.5 w-3.5" />
                                RPE
                              </label>
                              <Input
                                ref={(el) => { if (el) inputRefs.current.set(`${ej.id}-${serieIdx}-rpe`, el) }}
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={serie.rpe}
                                onChange={(e) => handleSerieChange(ej.id, serieIdx, "rpe", e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextInput(ej.id, serieIdx, "rpe") } }}
                                className="bg-card/80 dark:bg-zinc-900/80 border-border dark:border-white/[0.08] focus:border-green-500/50 focus:ring-green-500/20 text-foreground dark:text-white placeholder:text-foreground/60 dark:placeholder:text-zinc-300 h-14 text-xl font-bold text-center rounded-xl"
                              />
                            </div>
                          </div>

                          {/* Referencia anterior para esta serie (semana previa o bloque anterior en sem 1) */}
                          {mostrarAnterior && (
                            <div className="rounded-xl overflow-hidden border border-violet-500/15 bg-gradient-to-r from-violet-500/[0.07] to-transparent">
                              <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                                <div className="h-1 w-1 rounded-full bg-violet-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
                                  {anteriorLabelPrefix} · Serie {serieIdx + 1}
                                </span>
                              </div>
                              {anteriorSerie && (anteriorSerie.peso_kg !== null || anteriorSerie.repeticiones !== null || anteriorSerie.rpe !== null) ? (
                                <div className="flex items-stretch divide-x divide-white/[0.06] pb-2 px-1">
                                  {anteriorSerie.peso_kg !== null && (
                                    <div className="flex flex-col items-center flex-1 py-1 px-2">
                                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">Peso</span>
                                      <span className="text-lg font-black text-foreground dark:text-white leading-tight">{anteriorSerie.peso_kg}</span>
                                      <span className="text-[10px] text-muted-foreground dark:text-zinc-500">kg</span>
                                    </div>
                                  )}
                                  {anteriorSerie.repeticiones !== null && (
                                    <div className="flex flex-col items-center flex-1 py-1 px-2">
                                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">Reps</span>
                                      <span className="text-lg font-black text-foreground dark:text-white leading-tight">{anteriorSerie.repeticiones}</span>
                                      <span className="text-[10px] text-muted-foreground dark:text-zinc-500">rep</span>
                                    </div>
                                  )}
                                  {anteriorSerie.rpe !== null && (
                                    <div className="flex flex-col items-center flex-1 py-1 px-2">
                                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">RPE</span>
                                      <span className="text-lg font-black text-foreground dark:text-white leading-tight">{anteriorSerie.rpe}</span>
                                      <span className="text-[10px] text-muted-foreground dark:text-zinc-500">/10</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center pb-2 px-1 h-[52px]">
                                  <p className="text-[10px] text-muted-foreground dark:text-zinc-500">Sin registros en esta serie</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Notas */}
                  <div className="px-4 pt-14 space-y-1.5">
                    <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
                      <StickyNote className="h-3.5 w-3.5" />
                      Mis notas
                    </label>
                    <Textarea
                      placeholder="Opcional…"
                      maxLength={100}
                      className="min-h-16 resize-none bg-card/80 dark:bg-card dark:bg-zinc-900/80 border-border dark:border-white/[0.08] focus:border-green-500/50 focus:ring-green-500/20 text-foreground dark:text-white placeholder:text-muted-foreground/70 dark:text-zinc-600 text-base rounded-xl"
                      value={row.notas}
                      onChange={(e) => handleNotasChange(ej.id, e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground dark:text-zinc-400 text-right block">{row.notas.length}/100</span>
                  </div>
                </div>
                )}

                {/* Footer anclado al pie: Saltado / Completado / Saltar — uno a la vez. Saltado tiene prioridad sobre completado. */}
                {!previewPlan && (
                  esSaltado ? (
                    <button
                      onClick={() => handleToggleSkip(ej.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3.5 border-t border-amber-500/30 bg-amber-500/15 text-base font-bold text-amber-500 dark:text-amber-400 transition-colors active:scale-[0.99]"
                    >
                      <SkipForward className="h-5 w-5" />
                      Saltado
                    </button>
                  ) : isFilled ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-3.5 border-t border-green-500/30 bg-green-500/15 text-base font-bold text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      Completado
                    </div>
                  ) : (
                    <button
                      onClick={() => handleToggleSkip(ej.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3.5 border-t border-border dark:border-white/[0.07] bg-transparent text-base font-bold text-muted-foreground transition-colors active:scale-[0.99] hover:bg-amber-500/5 hover:text-amber-500 dark:hover:text-amber-400"
                    >
                      <SkipForward className="h-5 w-5" />
                      Saltar
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
        </>
      )}

      {/* Video modal */}
      {videoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setVideoModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border dark:border-white/[0.08] bg-background dark:bg-zinc-950 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-white/[0.06]">
              <p className="text-sm font-bold text-foreground dark:text-white truncate pr-4">{videoModal.nombre}</p>
              <button
                onClick={() => setVideoModal(null)}
                className="h-7 w-7 rounded-lg bg-muted/60 dark:bg-white/[0.06] hover:bg-muted/80 dark:bg-white/[0.1] flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground dark:text-zinc-400" />
              </button>
            </div>
            <div className="aspect-video w-full bg-card dark:bg-zinc-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="h-14 w-14 rounded-full bg-red-600 flex items-center justify-center">
                <Play className="h-6 w-6 text-foreground dark:text-white" fill="white" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground dark:text-white">Ver video del ejercicio</p>
                <p className="text-xs text-muted-foreground dark:text-zinc-500">Se abrirá en una nueva pestaña</p>
              </div>
              <a
                href={videoModal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-foreground dark:text-white text-sm font-bold px-5 py-2.5 transition-colors"
              >
                <Play className="h-3.5 w-3.5" fill="white" />
                Abrir video
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
