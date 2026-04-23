"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2, ClipboardList, ChevronLeft } from "lucide-react"

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

export function StudentPlanificacionSection({ studentId }: { studentId: number }) {
  const queryClient = useQueryClient()
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<number | null>(null)
  const [diaSeleccionadoId, setDiaSeleccionadoId] = useState<number | null>(null)
  const [registrosForm, setRegistrosForm] = useState<Record<number, FormRow>>({})
  const [saveMessage, setSaveMessage] = useState<string>("")

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

  const ejerciciosDelDia = diaSeleccionado?.ejercicios ?? []

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
    setRegistrosForm(next)
  }, [diaSeleccionado, ejerciciosDelDia, sessionData, semanaSeleccionada])

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
        estado: "abierta",
        registros,
      })
    },
    onSuccess: async () => {
      setSaveMessage("Guardado")
      if (!planificacion || !hojaActiva || !diaSeleccionado || !semanaSeleccionada) return
      await queryClient.invalidateQueries({
        queryKey: queryKeySesion(planificacion.id, studentId, hojaActiva.id, diaSeleccionado.id, semanaSeleccionada),
      })
    },
    onError: () => {
      setSaveMessage("No se pudo guardar")
    },
  })

  const handleFieldChange = (planEjId: number, field: keyof FormRow, value: string) => {
    setSaveMessage("")
    setRegistrosForm((prev) => ({
      ...prev,
      [planEjId]: {
        peso_kg: prev[planEjId]?.peso_kg ?? "",
        repeticiones: prev[planEjId]?.repeticiones ?? "",
        rpe: prev[planEjId]?.rpe ?? "",
        notas: prev[planEjId]?.notas ?? "",
        [field]: value,
      },
    }))
  }

  if (loadingPlan) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (errorPlan) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">No pudimos cargar tu planificación.</p>
      </div>
    )
  }

  if (!planificacion) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="h-4 w-4 text-[var(--primary-color)]" />
          Mi planificación
        </div>
        <p className="text-sm text-muted-foreground">Aun no tenés una planificación asignada.</p>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4">
      <div>
        <p className="text-base font-bold">Mi plan app</p>
        <p className="text-xs text-muted-foreground mt-0.5">{planificacion.nombre}</p>
      </div>

      {semanaSeleccionada === null ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seleccioná una semana</p>
          {Array.from({ length: totalSemanas }, (_, i) => i + 1).map((semana) => (
            <button
              key={semana}
              onClick={() => setSemanaSeleccionada(semana)}
              className="w-full text-left rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition-colors"
            >
              Semana {semana}
            </button>
          ))}
        </div>
      ) : diaSeleccionadoId === null ? (
        <div className="space-y-3">
          <button
            onClick={() => setSemanaSeleccionada(null)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Volver a semanas
          </button>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Semana {semanaSeleccionada} · elegí un día</p>
            {dias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Esta hoja no tiene días cargados.</p>
            ) : (
              dias.map((dia) => (
                <button
                  key={dia.id}
                  onClick={() => setDiaSeleccionadoId(dia.id)}
                  className="w-full text-left rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition-colors"
                >
                  Dia {dia.numero_dia} - {dia.nombre}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => {
              setDiaSeleccionadoId(null)
              setRegistrosForm({})
              setSaveMessage("")
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Volver a días
          </button>

          <p className="text-xs text-muted-foreground font-medium">
            Semana {semanaSeleccionada} · Dia {diaSeleccionado?.numero_dia} - {diaSeleccionado?.nombre}
          </p>

          {ejerciciosDelDia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este día no tiene ejercicios asignados.</p>
          ) : (
            <div className="space-y-3">
              {ejerciciosDelDia.map((ej) => {
                const semanaPlan = ej.semanas.find((s) => s.semana === semanaSeleccionada)
                const row = registrosForm[ej.id] ?? { peso_kg: "", repeticiones: "", rpe: "", notas: "" }

                return (
                  <div key={ej.id} className="rounded-xl border border-border p-3 space-y-3">
                    <div>
                      <p className="text-sm font-semibold leading-tight">{ej.ejercicios?.nombre ?? "Ejercicio"}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {semanaPlan?.dosis ? `Dosis: ${semanaPlan.dosis}` : "Sin dosis"}
                        {typeof semanaPlan?.rpe === "number" ? ` · RPE objetivo: ${semanaPlan.rpe}` : ""}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Peso (kg)"
                        inputMode="decimal"
                        value={row.peso_kg}
                        onChange={(e) => handleFieldChange(ej.id, "peso_kg", e.target.value)}
                      />
                      <Input
                        placeholder="Reps"
                        inputMode="numeric"
                        value={row.repeticiones}
                        onChange={(e) => handleFieldChange(ej.id, "repeticiones", e.target.value)}
                      />
                      <Input
                        placeholder="RPE"
                        inputMode="decimal"
                        value={row.rpe}
                        onChange={(e) => handleFieldChange(ej.id, "rpe", e.target.value)}
                      />
                    </div>

                    <Textarea
                      placeholder="Notas (opcional)"
                      className="min-h-20 resize-none"
                      value={row.notas}
                      onChange={(e) => handleFieldChange(ej.id, "notas", e.target.value)}
                    />
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-muted-foreground">
              {loadingSession ? "Cargando sesión..." : saveMessage || "Completá tus marcas y guardá"}
            </span>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={ejerciciosDelDia.length === 0 || saveMutation.isPending}
              className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
            >
              {saveMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando
                </span>
              ) : (
                "Guardar entrenamiento"
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
