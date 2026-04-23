"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { CATEGORIA_ROW_STYLE } from "@/types/planificaciones"
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  CalendarDays,
  CheckCircle2,
  Flame,
  Weight,
  RotateCcw,
  StickyNote,
  Trophy,
  Play,
  X,
  Save,
} from "lucide-react"

interface PlanSemana {
  semana: number
  dosis: string | null
  rpe: number | null
}

interface PlanEjercicioPortal {
  id: number
  planificacion_dia_id: number
  ejercicio_id: number
  categoria: string
  orden: number
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

interface PlanHojaPortal {
  id: number
  nombre: string
  numero: number
  estado: string
  dias: PlanDiaPortal[]
}

interface PlanificacionPortal {
  id: number
  nombre: string
  semanas: number
  hoja_activa_id: number | null
  hojas: PlanHojaPortal[]
}

interface RegistroSesion {
  id: number
  planificacion_ejercicio_id: number
  peso_kg: number | null
  repeticiones: number | null
  rpe: number | null
  notas: string | null
}

interface SsnData {
  sesion: { id: number; estado: string | null } | null
  registros: RegistroSesion[]
}

type FormRow = {
  peso_kg: string
  repeticiones: string
  rpe: string
  notas: string
}

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
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onRequestCloseRef = useRef(onRequestClose)
  onRequestCloseRef.current = onRequestClose
  const refetchResumenRef = useRef<(() => void) | null>(null)
  const refetchSesionesSemanaRef = useRef<(() => void) | null>(null)
  const [diaManualCompletado, setDiaManualCompletado] = useState<boolean | null>(null)
  const [openPicker, setOpenPicker] = useState<{ ejId: number; field: "repeticiones" | "rpe" } | null>(null)

  const { data: planData, isLoading: loadingPlan, isError: errorPlan } = useQuery<{ planificacion: PlanificacionPortal | null }>({
    queryKey: queryKeyPlan(studentId),
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/alumnos/${studentId}/planificacion`)
      return res.data
    },
    enabled: !!studentId,
  })

  const planificacion = planData?.planificacion ?? null

  useEffect(() => {
    setSemanaSeleccionada(null)
    setDiaSeleccionadoId(null)
    setRegistrosForm({})
    setSaveMessage("")
    setSavedSuccess(false)
  }, [planificacion?.id])

  const hojaActiva = useMemo(() => {
    if (!planificacion) return null
    return (
      planificacion.hojas.find((h) => h.id === planificacion.hoja_activa_id) ||
      planificacion.hojas[0] ||
      null
    )
  }, [planificacion])

  const dias = hojaActiva?.dias ?? []
  const totalSemanas = Math.max(1, planificacion?.semanas ?? 1)

  const diaSeleccionado = useMemo(
    () => dias.find((d) => d.id === diaSeleccionadoId) || null,
    [dias, diaSeleccionadoId]
  )

  const ejerciciosDelDia = useMemo(() => diaSeleccionado?.ejercicios ?? [], [diaSeleccionado])

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
  })

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
  })

  const registrosAnterioresMap = useMemo(
    () => new Map((sessionDataAnterior?.registros ?? []).map((r) => [r.planificacion_ejercicio_id, r])),
    [sessionDataAnterior]
  )

  useEffect(() => {
    if (!diaSeleccionado || !semanaSeleccionada) {
      setRegistrosForm({})
      return
    }

    const registrosMap = new Map(
      (sessionData?.registros ?? []).map((r) => [r.planificacion_ejercicio_id, r])
    )

    const next: Record<number, FormRow> = {}
    for (const ej of ejerciciosDelDia) {
      const existing = registrosMap.get(ej.id)
      next[ej.id] = {
        peso_kg: existing?.peso_kg?.toString() ?? "",
        repeticiones: existing?.repeticiones?.toString() ?? "",
        rpe: existing?.rpe?.toString() ?? "",
        notas: existing?.notas ?? "",
      }
    }
    isDirty.current = false
    setRegistrosForm(next)
    setDiaManualCompletado(sessionData?.sesion?.estado === "completado" ? true : null)
  }, [diaSeleccionado, ejerciciosDelDia, sessionData, semanaSeleccionada])

  const allCompletedAuto = useMemo(() => {
    if (ejerciciosDelDia.length === 0) return false
    return ejerciciosDelDia.every((ej) => {
      const row = registrosForm[ej.id]
      return !!row?.peso_kg && !!row?.repeticiones && !!row?.rpe
    })
  }, [ejerciciosDelDia, registrosForm])

  const allCompleted = diaManualCompletado !== null ? diaManualCompletado : allCompletedAuto

  const { data: sesionesSemana, refetch: _refetchSesionesSemana } = useQuery<{ sesiones: { id: number; dia_id: number; estado: string }[] }>({
    queryKey: ["portalSesionesSemana", planificacion?.id, studentId, hojaActiva?.id, semanaSeleccionada],
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/planificaciones/${planificacion!.id}/sesiones/semana`, {
        params: { alumno_id: studentId, hoja_id: hojaActiva!.id, semana: semanaSeleccionada },
      })
      return res.data
    },
    enabled: !!planificacion && !!hojaActiva && !!semanaSeleccionada && diaSeleccionadoId === null,
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
  })

  // Keep refetch refs up to date
  refetchSesionesSemanaRef.current = _refetchSesionesSemana
  refetchResumenRef.current = _refetchResumen

  // History API: push state on mount, handle back button
  useEffect(() => {
    history.pushState({ planNav: "weeks" }, "")
    if (historyDepthRef) historyDepthRef.current = 1

    function handlePopState(e: PopStateEvent) {
      if (historyDepthRef) historyDepthRef.current = Math.max(0, historyDepthRef.current - 1)
      const nav = (e.state as { planNav?: string; semana?: number } | null)
      if (nav?.planNav === "days") {
        setSemanaSeleccionada(nav.semana ?? null)
        setDiaSeleccionadoId(null)
        setRegistrosForm({})
        setSaveMessage("")
        setSavedSuccess(false)
        isDirty.current = false
        refetchSesionesSemanaRef.current?.()
      } else if (nav?.planNav === "weeks") {
        setSemanaSeleccionada(null)
        setDiaSeleccionadoId(null)
        setRegistrosForm({})
        setSaveMessage("")
        setSavedSuccess(false)
        isDirty.current = false
        refetchResumenRef.current?.()
      } else {
        onRequestCloseRef.current?.()
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    mutationFn: async () => {
      if (!planificacion || !hojaActiva || !diaSeleccionado || !semanaSeleccionada) return

      const registros = ejerciciosDelDia.map((ej) => ({
        planificacion_ejercicio_id: ej.id,
        peso_kg: registrosForm[ej.id]?.peso_kg ?? "",
        repeticiones: registrosForm[ej.id]?.repeticiones ?? "",
        rpe: registrosForm[ej.id]?.rpe ?? "",
        notas: registrosForm[ej.id]?.notas ?? "",
      }))

      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/planificaciones/${planificacion.id}/sesiones`, {
        alumno_id: studentId,
        hoja_id: hojaActiva.id,
        dia_id: diaSeleccionado.id,
        semana: semanaSeleccionada,
        estado: allCompleted ? "completado" : "abierta",
        registros,
      })
    },
    onSuccess: async () => {
      isDirty.current = false
      setSavedSuccess(true)
      setSaveMessage("")
      if (!planificacion || !hojaActiva || !diaSeleccionado || !semanaSeleccionada) return
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeySesion(planificacion.id, studentId, hojaActiva.id, diaSeleccionado.id, semanaSeleccionada),
        }),
        queryClient.invalidateQueries({
          queryKey: ["portalSesionesSemana", planificacion.id, studentId, hojaActiva.id, semanaSeleccionada],
        }),
        queryClient.invalidateQueries({
          queryKey: ["portalSesionesResumen", planificacion.id, studentId, hojaActiva.id],
        }),
      ])
    },
    onError: () => {
      setSaveMessage("No se pudo guardar")
    },
  })

  const saveMutateRef = useRef(saveMutation.mutate)
  saveMutateRef.current = saveMutation.mutate
  const saveIsPendingRef = useRef(saveMutation.isPending)
  saveIsPendingRef.current = saveMutation.isPending

  useEffect(() => {
    if (!diaSeleccionado || !semanaSeleccionada) return
    const interval = setInterval(() => {
      if (isDirty.current && !saveIsPendingRef.current) {
        saveMutateRef.current()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [diaSeleccionado, semanaSeleccionada])

  const prevAllCompletedAuto = useRef(false)
  useEffect(() => {
    if (allCompletedAuto && !prevAllCompletedAuto.current && isDirty.current && !saveIsPendingRef.current) {
      saveMutateRef.current()
    }
    prevAllCompletedAuto.current = allCompletedAuto
  }, [allCompletedAuto])

  const handleFieldChange = (planEjId: number, field: keyof FormRow, value: string) => {
    isDirty.current = true
    setSaveMessage("")
    setSavedSuccess(false)
    setRegistrosForm((prev) => {
      const updated = {
        ...prev,
        [planEjId]: {
          peso_kg: prev[planEjId]?.peso_kg ?? "",
          repeticiones: prev[planEjId]?.repeticiones ?? "",
          rpe: prev[planEjId]?.rpe ?? "",
          notas: prev[planEjId]?.notas ?? "",
          [field]: value,
        },
      }
      const row = updated[planEjId]
      if (row.peso_kg && row.repeticiones && row.rpe) {
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
        saveDebounceRef.current = setTimeout(() => {
          if (!saveIsPendingRef.current) saveMutateRef.current()
        }, 800)
      }
      return updated
    })
  }

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          <p className="text-xs text-zinc-500">Cargando tu planificación…</p>
        </div>
      </div>
    )
  }

  if (errorPlan) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center">
        <p className="text-sm text-zinc-400">No pudimos cargar tu planificación.</p>
      </div>
    )
  }

  if (!planificacion) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center space-y-3">
        <div className="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto">
          <Dumbbell className="h-6 w-6 text-zinc-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-300">Sin planificación asignada</p>
          <p className="text-xs text-zinc-500 mt-1">Tu entrenador aún no te asignó un plan.</p>
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
            <h2 className="text-base font-bold text-white">{planificacion.nombre}</h2>
          </div>
          <p className="text-xs text-zinc-500 pl-9">{totalSemanas} semanas · {hojaActiva?.nombre}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Seleccioná una semana</p>
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
                  className={`group relative rounded-2xl border active:scale-95 transition-all duration-150 p-4 text-left overflow-hidden ${
                    completada
                      ? "border-green-500/40 bg-green-500/[0.07] hover:bg-green-500/[0.11]"
                      : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-green-500/30 active:bg-green-500/20 active:border-green-500/60"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 group-hover:from-green-500/5 to-transparent transition-all duration-200" />
                  <span className={`block text-[10px] font-semibold uppercase tracking-widest transition-colors ${completada ? "text-green-500/70" : "text-zinc-500 group-hover:text-green-500/70"}`}>Semana</span>
                  <span className="block text-3xl font-black text-white mt-0.5 leading-none">{semana}</span>
                  {completada
                    ? <CheckCircle2 className="absolute right-3 bottom-3.5 h-4 w-4 text-green-400" />
                    : <ChevronRight className="absolute right-3 bottom-3.5 h-4 w-4 text-zinc-600 group-hover:text-green-500/50 transition-colors" />
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
            className="h-8 w-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-zinc-400" />
          </button>
          <div>
            <p className="text-xs text-zinc-500">Semana {semanaSeleccionada}</p>
            <p className="text-sm font-bold text-white leading-tight">Elegí un día</p>
          </div>
        </div>

        {dias.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">Esta hoja no tiene días cargados.</p>
        ) : (
          <div className="space-y-2.5">
            {dias.map((dia) => (
              <button
                key={dia.id}
                onClick={() => {
                  history.pushState({ planNav: "exercises" }, "")
                  if (historyDepthRef) historyDepthRef.current++
                  setDiaSeleccionadoId(dia.id)
                }}
                className={`group w-full rounded-2xl border transition-all duration-150 p-4 text-left flex items-center gap-4 overflow-hidden relative active:scale-95 ${
                  sesionesMapSemana.get(dia.id)?.estado === "completado"
                    ? "border-green-500/30 bg-green-500/[0.05] hover:bg-green-500/[0.08]"
                    : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-green-500/25 active:bg-green-500/20 active:border-green-500/60"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 group-hover:from-green-500/[0.04] to-transparent transition-all duration-200" />
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                  sesionesMapSemana.get(dia.id)?.estado === "completado"
                    ? "bg-green-500/20"
                    : "bg-zinc-800 group-hover:bg-green-500/15"
                }`}>
                  {sesionesMapSemana.get(dia.id)?.estado === "completado"
                    ? <CheckCircle2 className="h-5 w-5 text-green-400" />
                    : <span className="text-base font-black text-zinc-300 group-hover:text-green-400 transition-colors">{dia.numero_dia}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">DIA {dia.numero_dia} - {dia.nombre}</p>
                  <p className={`text-[11px] mt-0.5 ${sesionesMapSemana.get(dia.id)?.estado === "completado" ? "text-green-500/70" : "text-zinc-500"}`}>
                    {sesionesMapSemana.get(dia.id)?.estado === "completado"
                      ? "Completado"
                      : `${dia.ejercicios.length} ejercicio${dia.ejercicios.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-green-500/50 transition-colors flex-shrink-0" />
              </button>
            ))}
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
          onClick={() => history.back()}
          className="h-8 w-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] flex items-center justify-center transition-colors flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4 text-zinc-400" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-zinc-500">Semana {semanaSeleccionada}</p>
          <p className="text-sm font-bold text-white leading-tight truncate">
            Día {diaSeleccionado?.numero_dia} · {diaSeleccionado?.nombre}
          </p>
        </div>
        {loadingSession
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500 flex-shrink-0" />
          : (
            <button
              onClick={() => {
                const next = !allCompleted
                setDiaManualCompletado(next)
                isDirty.current = true
                setTimeout(() => saveMutateRef.current(), 0)
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all flex-shrink-0 ${
                allCompleted
                  ? "bg-green-500/15 border-green-500/30 text-green-400"
                  : "bg-white/[0.04] border-white/[0.08] text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <CheckCircle2 className={`h-3.5 w-3.5 ${allCompleted ? "text-green-400" : "text-zinc-600"}`} />
              {allCompleted ? "Completado" : "Marcar"}
            </button>
          )
        }
      </div>

      {/* Exercise cards */}
      {ejerciciosDelDia.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-8">Este día no tiene ejercicios asignados.</p>
      ) : (
        <div className="space-y-3">
          {ejerciciosDelDia.map((ej, idx) => {
            const semanaPlan = ej.semanas.find((s) => s.semana === semanaSeleccionada)
            const row = registrosForm[ej.id] ?? { peso_kg: "", repeticiones: "", rpe: "", notas: "" }
            const isFilled = !!row.peso_kg && !!row.repeticiones && !!row.rpe
            const regAnterior = registrosAnterioresMap.get(ej.id) ?? null
            const catStyle = CATEGORIA_ROW_STYLE[ej.categoria] ?? {}
            const catColor = catStyle.color as string | undefined
            const catBg = catStyle.backgroundColor as string | undefined

            return (
              <div
                key={ej.id}
                className="rounded-2xl border border-white/[0.07] overflow-hidden transition-all duration-200"
              >
                {/* Category color strip */}
                <div
                  className="px-4 pt-3 pb-2 flex items-center gap-2"
                  style={{ backgroundColor: catBg ? `color-mix(in srgb, ${catBg} 60%, transparent)` : undefined }}
                >
                  <span
                    className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                    style={{ color: catColor, backgroundColor: catBg }}
                  >
                    {ej.categoria}
                  </span>
                  {isFilled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400 ml-auto">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Completado
                    </span>
                  )}
                </div>

                {/* Exercise header */}
                <div className="px-4 pt-2 pb-3 flex items-center gap-2.5">
                  {ej.ejercicios?.video_url ? (
                    <button
                      onClick={() => setVideoModal({ nombre: ej.ejercicios!.nombre, url: ej.ejercicios!.video_url! })}
                      className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: catBg, color: catColor }}
                    >
                      <Play className="h-3 w-3" fill="currentColor" />
                    </button>
                  ) : (
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 opacity-25"
                      style={{ backgroundColor: catBg, color: catColor }}
                    >
                      <Play className="h-3 w-3" fill="currentColor" />
                    </div>
                  )}
                  <p className="text-xs font-semibold text-white leading-snug flex-1 min-w-0">
                    {ej.ejercicios?.nombre ?? "Ejercicio"}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {semanaPlan?.dosis && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-bold text-blue-400">
                        <CalendarDays className="h-3 w-3" />
                        {semanaPlan.dosis}
                      </span>
                    )}
                    {typeof semanaPlan?.rpe === "number" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-xs font-bold text-orange-400">
                        <Flame className="h-3 w-3" />
                        RPE {semanaPlan.rpe}
                      </span>
                    )}
                  </div>
                </div>

                {/* Inputs */}
                <div className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        <Weight className="h-2.5 w-2.5" />
                        Peso kg
                      </label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={row.peso_kg}
                        onChange={(e) => handleFieldChange(ej.id, "peso_kg", e.target.value)}
                        className="bg-zinc-900/80 border-white/[0.08] focus:border-green-500/50 focus:ring-green-500/20 text-white placeholder:text-zinc-600 h-12 text-base font-bold text-center rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        <RotateCcw className="h-2.5 w-2.5" />
                        Reps
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => setOpenPicker(openPicker?.ejId === ej.id && openPicker.field === "repeticiones" ? null : { ejId: ej.id, field: "repeticiones" })}
                          className={`w-full h-12 rounded-xl border text-base font-bold text-center transition-all flex items-center justify-center gap-1 ${
                            row.repeticiones ? "bg-zinc-800 border-green-500/30 text-white" : "bg-zinc-900/80 border-white/[0.08] text-zinc-500"
                          }`}
                        >
                          {row.repeticiones || "—"}
                        </button>
                        {openPicker?.ejId === ej.id && openPicker.field === "repeticiones" && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setOpenPicker(null)} />
                            <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-white/[0.1] bg-zinc-900 shadow-2xl overflow-hidden">
                              <div className="max-h-48 overflow-y-auto">
                                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                                  <button
                                    key={n}
                                    onClick={() => { handleFieldChange(ej.id, "repeticiones", String(n)); setOpenPicker(null) }}
                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-left transition-colors ${
                                      row.repeticiones === String(n)
                                        ? "bg-green-500/20 text-green-400"
                                        : "text-zinc-300 hover:bg-white/[0.06]"
                                    }`}
                                  >
                                    {n} reps
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        <Flame className="h-2.5 w-2.5" />
                        RPE
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => setOpenPicker(openPicker?.ejId === ej.id && openPicker.field === "rpe" ? null : { ejId: ej.id, field: "rpe" })}
                          className={`w-full h-12 rounded-xl border text-base font-bold text-center transition-all flex items-center justify-center gap-1 ${
                            row.rpe ? "bg-zinc-800 border-green-500/30 text-white" : "bg-zinc-900/80 border-white/[0.08] text-zinc-500"
                          }`}
                        >
                          {row.rpe || "—"}
                        </button>
                        {openPicker?.ejId === ej.id && openPicker.field === "rpe" && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setOpenPicker(null)} />
                            <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-white/[0.1] bg-zinc-900 shadow-2xl overflow-hidden">
                              {Array.from({ length: 6 }, (_, i) => 10 - i).map((n) => (
                                <button
                                  key={n}
                                  onClick={() => { handleFieldChange(ej.id, "rpe", String(n)); setOpenPicker(null) }}
                                  className={`w-full px-4 py-2.5 text-sm font-semibold text-left transition-colors ${
                                    row.rpe === String(n)
                                      ? "bg-green-500/20 text-green-400"
                                      : "text-zinc-300 hover:bg-white/[0.06]"
                                  }`}
                                >
                                  RPE {n}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      <StickyNote className="h-2.5 w-2.5" />
                      Notas
                    </label>
                    <Textarea
                      placeholder="Opcional…"
                      className="min-h-16 resize-none bg-zinc-900/80 border-white/[0.08] focus:border-green-500/50 focus:ring-green-500/20 text-white placeholder:text-zinc-600 text-sm rounded-xl"
                      value={row.notas}
                      onChange={(e) => handleFieldChange(ej.id, "notas", e.target.value)}
                    />
                  </div>

                  {regAnterior && (regAnterior.peso_kg !== null || regAnterior.repeticiones !== null || regAnterior.rpe !== null) && (
                    <div className="rounded-xl overflow-hidden border border-violet-500/15 bg-gradient-to-r from-violet-500/[0.07] to-transparent">
                      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                        <div className="h-1 w-1 rounded-full bg-violet-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                          Semana {semanaAnterior}
                        </span>
                      </div>
                      <div className="flex items-stretch divide-x divide-white/[0.06] pb-2 px-1">
                        {regAnterior.peso_kg !== null && (
                          <div className="flex flex-col items-center flex-1 py-1 px-2">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Peso</span>
                            <span className="text-base font-black text-white leading-tight">{regAnterior.peso_kg}</span>
                            <span className="text-[9px] text-zinc-500">kg</span>
                          </div>
                        )}
                        {regAnterior.repeticiones !== null && (
                          <div className="flex flex-col items-center flex-1 py-1 px-2">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Reps</span>
                            <span className="text-base font-black text-white leading-tight">{regAnterior.repeticiones}</span>
                            <span className="text-[9px] text-zinc-500">rep</span>
                          </div>
                        )}
                        {regAnterior.rpe !== null && (
                          <div className="flex flex-col items-center flex-1 py-1 px-2">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">RPE</span>
                            <span className="text-base font-black text-white leading-tight">{regAnterior.rpe}</span>
                            <span className="text-[9px] text-zinc-500">/10</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Save bar */}
      <div className="sticky bottom-0 pt-2">
        <div className="rounded-t-2xl border border-b-0 border-white/[0.07] bg-zinc-950/90 backdrop-blur-xl px-5 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            {savedSuccess && allCompleted ? (
              <span className="flex items-center gap-2 text-sm font-semibold text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Día completado
              </span>
            ) : savedSuccess ? (
              <span className="flex items-center gap-2 text-sm font-semibold text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Guardado
              </span>
            ) : isDirty.current ? (
              <span className="text-sm text-zinc-400">Cambios sin guardar…</span>
            ) : loadingSession ? (
              <span className="text-sm text-zinc-500">Cargando sesión…</span>
            ) : saveMessage ? (
              <span className="text-sm text-red-400">{saveMessage}</span>
            ) : allCompleted ? (
              <span className="flex items-center gap-2 text-sm font-semibold text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Día completado
              </span>
            ) : (
              <span className="text-sm text-zinc-400">Completá tus marcas y guardá</span>
            )}
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={ejerciciosDelDia.length === 0 || saveMutation.isPending}
            className="bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl w-14 h-14 p-0 flex-shrink-0 transition-all"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Save className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>

      {/* Video modal */}
      {videoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setVideoModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-zinc-950 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <p className="text-sm font-bold text-white truncate pr-4">{videoModal.nombre}</p>
              <button
                onClick={() => setVideoModal(null)}
                className="h-7 w-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            </div>
            <div className="aspect-video w-full bg-zinc-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="h-14 w-14 rounded-full bg-red-600 flex items-center justify-center">
                <Play className="h-6 w-6 text-white" fill="white" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Ver video del ejercicio</p>
                <p className="text-xs text-zinc-500">Se abrirá en una nueva pestaña</p>
              </div>
              <a
                href={videoModal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-5 py-2.5 transition-colors"
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
