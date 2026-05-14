"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useMediaQuery } from "@mui/material"
import { AlertTriangle, Calendar, ClipboardList, Edit, FileText, MessageSquare, MoreHorizontal, MoreVertical, Plus, Search, StickyNote, Trash2, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddStudentDialog } from "./add-student-dialog"
import { EditStudentDialog } from "./edit-student-dialog"
import { DeleteStudentDialog } from "./delete-student-dialog"
import { Loader } from "@/components/ui/loader"
import { determineSubscriptionStatus, formatDate, getStatusColor } from "@/lib/payment-utils"
import { GenericDataGrid } from "@/components/tables/DataGrid"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GridColDef } from "@mui/x-data-grid"
import axios from "axios"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePlanes, getPlanColor } from "@/hooks/use-planes"
import type { Planificacion } from "@/types/planificaciones"
import { CATEGORIA_COLORS, CATEGORIA_ROW_STYLE } from "@/types/planificaciones"

interface Student {
  id: number
  nombre: string
  modalidad: string
  dias: string
  fecha_de_nacimiento: string
  fecha_de_inicio: string
  ultima_antro: string
  email?: string
  telefono: string
  plan: string
  status?: string
  fecha_de_vencimiento?: string
}

interface Payment {
  alumno_id: number
  fecha_de_pago: string
  fecha_de_vencimiento: string
  status: string
}

const STATUS_RANK: Record<string, number> = {
  Pagado: 1,
  Vencido: 2,
  Pendiente: 3,
  Indefinido: 4,
}


const statusLabel = (status?: string) =>
  status === "Pagado" ? "Activo" : status === "Indefinido" ? "Indefinido" : "Inactivo"

function StatusBadge({ status, fechaVencimiento, className, style }: { status?: string; fechaVencimiento?: string; className?: string; style?: React.CSSProperties }) {
  const [showDate, setShowDate] = useState(false)
  const label = statusLabel(status)
  const vencimiento = fechaVencimiento ? formatDate(fechaVencimiento) : null
  const dateText = vencimiento
    ? status === "Pagado" ? `Vence ${vencimiento}` : `Venció ${vencimiento}`
    : label
  return (
    <Badge
      style={{ backgroundColor: getStatusColor(status || "Indefinido"), cursor: vencimiento ? "pointer" : "default", ...style }}
      className={`text-white ${className ?? ""}`}
      onMouseEnter={() => vencimiento && setShowDate(true)}
      onMouseLeave={() => setShowDate(false)}
      onClick={(e) => { e.stopPropagation(); vencimiento && setShowDate((v) => !v) }}
    >
      {showDate ? dateText : label}
    </Badge>
  )
}

function StatusBadgeMobile({ status, fechaVencimiento }: { status?: string; fechaVencimiento?: string }) {
  const [open, setOpen] = useState(false)
  const label = statusLabel(status)
  const vencimiento = fechaVencimiento ? formatDate(fechaVencimiento) : null
  const tooltipText = vencimiento
    ? status === "Pagado" ? `Vence el ${vencimiento}` : `Venció el ${vencimiento}`
    : "Sin fecha de vencimiento"
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Badge
            style={{ backgroundColor: getStatusColor(status || "Indefinido"), cursor: "pointer" }}
            className="h-6 text-white"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          >
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="z-[9999]">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const SEMANAS_PREVIEW = [1, 2, 3, 4, 5, 6]

// ─── Progreso dialog ──────────────────────────────────────────────────────────

function StudentProgresoDialog({
  student,
  open,
  onOpenChange,
}: {
  student: Student | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [plan, setPlan] = useState<Planificacion | null>(null)
  const [progresoData, setProgresoData] = useState<{ sesiones: any[]; registros: any[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [estadoPopover, setEstadoPopover] = useState<string | null>(null)
  const [comentarioModal, setComentarioModal] = useState<{ ejercicio: string; comentario: string } | null>(null)

  useEffect(() => {
    if (!open || !student) return
    setPlan(null)
    setProgresoData(null)
    setLoading(true)
    axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/alumno/${student.id}`)
      .then(async (res) => {
        const plans = res.data
        if (!plans.length) { setLoading(false); return }
        const [planRes, progresoRes] = await Promise.all([
          axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${plans[0].id}`),
          axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${plans[0].id}/progreso`),
        ])
        setPlan(planRes.data)
        setProgresoData(progresoRes.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [open, student])

  const dias = useMemo(() => {
    if (!plan) return []
    return plan.hojas
      .flatMap((h) => h.dias)
      .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
  }, [plan])

  const sesionMap = useMemo(() => {
    const m = new Map<string, any>()
    progresoData?.sesiones?.forEach((s: any) => m.set(`${s.dia_id}-${s.semana}`, s))
    return m
  }, [progresoData])

  const registroMap = useMemo(() => {
    const m = new Map<string, any>()
    progresoData?.registros?.forEach((r: any) => m.set(`${r.sesion_id}-${r.planificacion_ejercicio_id}`, r))
    return m
  }, [progresoData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full flex flex-col p-0 max-h-[88vh]">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Progreso — {student?.nombre}
            {plan && <span className="text-muted-foreground font-normal text-sm">· {plan.nombre}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader /></div>
          ) : !plan ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sin planificación asignada.</p>
          ) : dias.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sin días en la planificación.</p>
          ) : (
            dias.map((dia) => {
              const ejercicios = [...dia.ejercicios].sort((a, b) => a.orden - b.orden)
              if (ejercicios.length === 0) return null
              return (
                <div key={dia.id}>
                  <h3 className="text-sm font-semibold mb-3">
                    DIA {dia.numero_dia} — {dia.nombre}
                    <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {ejercicios.length}
                    </span>
                  </h3>
                  <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-14">#</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Ejercicio</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Cat.</th>
                          {SEMANAS_PREVIEW.map((s) => {
                            const sesion = sesionMap.get(`${dia.id}-${s}`)
                            const flags = [
                              { key: "durmio_mal", label: "Dormí mal", color: "text-indigo-400", bg: "bg-indigo-500/15" },
                              { key: "fatiga", label: "Fatiga", color: "text-amber-400", bg: "bg-amber-500/15" },
                              { key: "desmotivacion", label: "Motivación", color: "text-cyan-400", bg: "bg-cyan-500/15" },
                              { key: "dolor", label: "Dolor", color: "text-rose-400", bg: "bg-rose-500/15" },
                            ]
                            const active = sesion ? flags.filter((f) => !!sesion[f.key as keyof typeof sesion]) : []
                            const popoverKey = `${dia.id}-${s}`
                            return (
                              <th key={s} className={`px-0 py-2.5 text-center font-semibold w-[144px] relative ${s > 1 ? "border-l-2 border-border" : ""}`}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <span>S{s}</span>
                                  {sesion && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEstadoPopover(estadoPopover === popoverKey ? null : popoverKey) }}
                                      className={`rounded-full p-0.5 transition-colors ${active.length > 0 ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground/30 hover:text-muted-foreground/50"}`}
                                    >
                                      <AlertTriangle className="h-3 w-3" fill={active.length > 0 ? "currentColor" : "none"} />
                                    </button>
                                  )}
                                </div>
                                {estadoPopover === popoverKey && (
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 rounded-lg border bg-popover p-2 shadow-md min-w-[130px]">
                                    {active.length === 0 ? (
                                      <span className="text-[10px] text-green-400">Perfecto</span>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        {active.map((f) => (
                                          <span key={f.key} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${f.bg} ${f.color}`}>{f.label}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="flex text-[10px] font-normal text-muted-foreground">
                                  <span className="w-6"></span>
                                  <span className="flex-1 text-center">kg</span>
                                  <span className="flex-1 text-center">reps</span>
                                  <span className="flex-1 text-center">rpe</span>
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {ejercicios.map((ej, idx) => {
                          const categoria = ej.categoria
                          return (
                            <tr key={ej.id} style={CATEGORIA_ROW_STYLE[categoria]} className="hover:brightness-95 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                              <td className="px-4 py-3 font-medium">{ej.ejercicios.nombre}</td>
                              <td className="px-4 py-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORIA_COLORS[categoria] ?? ""}`}>
                                  {categoria}
                                </span>
                              </td>
                              {SEMANAS_PREVIEW.map((semana) => {
                                const sesion = sesionMap.get(`${dia.id}-${semana}`)
                                const registro = sesion ? registroMap.get(`${sesion.id}-${ej.id}`) : null
                                const borderSemana = semana > 1 ? "border-l-2 border-border" : ""
                                if (!registro) {
                                  return (
                                    <td key={semana} className={`px-3 py-3 text-center ${borderSemana}`}>
                                      <span className="text-muted-foreground/25 text-xs">—</span>
                                    </td>
                                  )
                                }
                                const series: any[] = registro.series ?? []
                                const esSaltado = series.length > 0
                                  ? series.every((s: any) => (s.peso_kg ?? 0) === 0)
                                  : (registro.peso_kg ?? 0) === 0
                                if (esSaltado) {
                                  return (
                                    <td key={semana} className={`px-3 py-2 text-center align-middle ${borderSemana}`}>
                                      <span className="text-[10px] text-amber-400/70 font-medium italic">Saltado</span>
                                    </td>
                                  )
                                }
                                if (series.length === 0) {
                                  const nota = registro.notas as string | null
                                  return (
                                    <td key={semana} className={`p-0 text-center align-middle ${borderSemana}`}>
                                      <div className="grid grid-cols-3 divide-x h-full min-h-[40px]">
                                        <div className="flex items-center justify-center px-2 font-bold text-sm tabular-nums">{registro.peso_kg ?? "—"}</div>
                                        <div className="flex items-center justify-center px-2 text-xs text-muted-foreground tabular-nums">{registro.repeticiones ?? "—"}</div>
                                        <div className="flex items-center justify-center px-2 text-xs text-muted-foreground/70 tabular-nums">{registro.rpe ?? "—"}</div>
                                      </div>
                                      {nota && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setComentarioModal({ ejercicio: ej.ejercicios.nombre, comentario: nota }) }}
                                          className="px-1 pb-1 text-[9px] text-blue-400 hover:text-blue-300 italic flex items-center justify-center gap-0.5 w-full"
                                        >
                                          <StickyNote className="h-2.5 w-2.5" />
                                          Comentario
                                        </button>
                                      )}
                                    </td>
                                  )
                                }
                                const nota = registro.notas as string | null
                                return (
                                  <td key={semana} className={`p-0 text-center align-top ${borderSemana}`}>
                                    <div className="divide-y">
                                      {series.map((s: any, si: number) => (
                                        <div key={si} className="flex">
                                          <div className="flex items-center justify-center w-6 text-[10px] text-muted-foreground/50 font-medium border-r">S{si + 1}</div>
                                          <div className="grid grid-cols-3 divide-x flex-1">
                                            <div className="flex items-center justify-center px-2 py-1.5 font-bold text-xs tabular-nums">{s.peso_kg ?? "—"}</div>
                                            <div className="flex items-center justify-center px-2 py-1.5 text-[11px] text-muted-foreground tabular-nums">{s.repeticiones ?? "—"}</div>
                                            <div className="flex items-center justify-center px-2 py-1.5 text-[11px] text-muted-foreground/70 tabular-nums">{s.rpe ?? "—"}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    {nota && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setComentarioModal({ ejercicio: ej.ejercicios.nombre, comentario: nota }) }}
                                        className="px-1 py-0.5 text-[9px] text-blue-400 hover:text-blue-300 italic flex items-center justify-center gap-0.5 w-full border-t border-border/30"
                                      >
                                        <StickyNote className="h-2.5 w-2.5" />
                                        Comentario
                                      </button>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {comentarioModal && (
          <Dialog open={!!comentarioModal} onOpenChange={() => setComentarioModal(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-blue-400" />
                  Comentario del alumno
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground mb-1">{comentarioModal.ejercicio}</p>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {comentarioModal.comentario}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Subcomponente mobile ─────────────────────────────────────────────────────

function StudentMobileCard({
  student,
  onEdit,
  onDelete,
  onProgreso,
  onPlanApp,
  hasPlan,
}: {
  student: Student
  onEdit: (s: Student) => void
  onDelete: (s: Student) => void
  onProgreso: (s: Student) => void
  onPlanApp: (s: Student) => void
  hasPlan: boolean
}) {
  return (
    <Card className="p-3 py-4 w-full overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{student.nombre}</CardTitle>
            <CardDescription className="text-base mt-0.5">{student.modalidad}</CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadgeMobile status={student.status} fechaVencimiento={student.fecha_de_vencimiento} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(student)} className="text-blue-600 cursor-pointer">
                  <Edit className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(student)} className="text-red-600 cursor-pointer">
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(() => {
          const diasStr = (student.dias || "").split(" - ")[0]
          const horario = (student.dias || "").split(" - ")[1] || ""
          const countMatch = diasStr.match(/^(\d+)\s*días?/)
          const count = countMatch ? parseInt(countMatch[1]) : diasStr.split(",").filter((d) => d.trim()).length
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`flex-1 h-7 rounded-md border ${
                      n <= count
                        ? "bg-[var(--primary-color)] border-[var(--primary-color)]"
                        : "bg-muted border-border"
                    }`}
                  />
                ))}
              </div>
              {horario && (
                <span className="text-xs text-muted-foreground">{count} {count === 1 ? "día" : "días"} — {horario}</span>
              )}
            </div>
          )
        })()}
        <div className="rounded-lg py-2 flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Nacimiento</span>
          <span className="text-sm font-medium">{formatDate(student.fecha_de_nacimiento || "")}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <a
              href={`https://wa.me/${student.telefono.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center py-2 rounded bg-[var(--primary-color)] text-white hover:bg-green-600 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="ml-2">WhatsApp</span>
            </a>
            <a
              href={student.plan}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span className="ml-2">Plan</span>
            </a>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => hasPlan && onPlanApp(student)}
              disabled={!hasPlan}
              className="flex-1 flex items-center justify-center py-2 rounded bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ClipboardList className="h-4 w-4" />
              <span className="ml-2">Plan App</span>
            </button>
            <button
              onClick={() => hasPlan && onProgreso(student)}
              disabled={!hasPlan}
              className="flex-1 flex items-center justify-center py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="ml-2">Progreso</span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function StudentsTable({ onOpenPlan }: { onOpenPlan?: (planId: number) => void }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false)
  const [isDeleteStudentOpen, setIsDeleteStudentOpen] = useState(false)
  const [isProgresoOpen, setIsProgresoOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const { data: planes = [] } = usePlanes()

  const { data: rawStudents = [], isLoading } = useQuery({
    queryKey: queryKeys.students,
    queryFn: () =>
      axios.get<Student[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getallstudents`).then((r) => r.data),
  })

  const { data: rawPayments = [] } = useQuery({
    queryKey: queryKeys.payments,
    queryFn: () =>
      axios.get<Payment[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllPayments`).then((r) => r.data),
  })

  const { data: planificaciones = [] } = useQuery({
    queryKey: queryKeys.planificaciones,
    queryFn: () =>
      axios.get<{ id: number; alumno_id: number | null }[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones`).then((r) => r.data),
  })

  const alumnosConPlan = useMemo(() => {
    const m = new Map<number, number>()
    for (const p of planificaciones) {
      if (p.alumno_id != null && !m.has(p.alumno_id)) m.set(p.alumno_id, p.id)
    }
    return m
  }, [planificaciones])

  const payments = useMemo(
    () => rawPayments.map((p) => ({ ...p, status: determineSubscriptionStatus(p) })),
    [rawPayments]
  )

  const students = useMemo(() => {
    if (!rawStudents.length) return rawStudents
    return rawStudents.map((student) => {
      const pagosAlumno = payments
        .filter((p) => Number(p.alumno_id) === Number(student.id))
        .sort((a, b) => new Date(b.fecha_de_pago).getTime() - new Date(a.fecha_de_pago).getTime())
      return {
        ...student,
        status: pagosAlumno[0]?.status ?? "Indefinido",
        fecha_de_vencimiento: pagosAlumno[0]?.fecha_de_vencimiento ?? undefined,
      }
    })
  }, [rawStudents, payments])

  const sortedStudents = useMemo(
    () =>
      students
        .filter((s) => {
          const matchesSearch =
            s.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.modalidad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.telefono?.includes(searchTerm) ||
            s.status?.toLowerCase().includes(searchTerm.toLowerCase())
          const matchesStatus =
            !statusFilter ||
            (statusFilter === "Activo" && s.status === "Pagado") ||
            (statusFilter === "Vencido" && (s.status === "Vencido" || s.status === "Pendiente")) ||
            (statusFilter === "Indefinido" && s.status === "Indefinido")
          return matchesSearch && matchesStatus
        })
        .sort((a, b) => {
          const ra = STATUS_RANK[a.status || "Indefinido"] ?? 99
          const rb = STATUS_RANK[b.status || "Indefinido"] ?? 99
          return ra - rb
        }),
    [students, searchTerm, statusFilter]
  )

  const isLg = useMediaQuery("(min-width:1024px)")
  const isXl = useMediaQuery("(min-width:1280px)")

  const handleEdit = (student: Student) => { setSelectedStudent(student); setIsEditStudentOpen(true) }
  const handleDelete = (student: Student) => { setSelectedStudent(student); setIsDeleteStudentOpen(true) }
  const handleProgreso = (student: Student) => { setSelectedStudent(student); setIsProgresoOpen(true) }
  const handleOpenPlanApp = (student: Student) => {
    const planId = alumnosConPlan.get(student.id)
    if (planId != null) onOpenPlan?.(planId)
  }

  // Ocultar columnas menos importantes en pantallas más chicas
  const columnVisibilityModel = useMemo(() => ({
    fecha_de_nacimiento: isLg,
    fecha_de_inicio: isLg,
  }), [isLg, isXl])

  const studentsColumns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre Completo", flex: 1.5, minWidth: 130 },
    {
      field: "modalidad", headerName: "Tipo de plan", flex: 0.9, minWidth: 110,
      renderCell: ({ value }) => (
        <span className="flex items-center">
          <span className="inline-block w-[10px] h-[10px] rounded-full mr-2" style={{ backgroundColor: getPlanColor(planes, value) }} />
          {value}
        </span>
      ),
    },
    {
      field: "dias", headerName: "Días y Turnos", flex: 1.2, minWidth: 160,
      renderCell: ({ value }) => {
        const diasStr = (value || "").split(" - ")[0]
        const horario = (value || "").split(" - ")[1] || ""
        const countMatch = diasStr.match(/^(\d+)\s*días?/)
        const count = countMatch ? parseInt(countMatch[1]) : diasStr.split(",").filter((d: string) => d.trim()).length
        return (
          <span className="flex items-center gap-1.5 w-full">
            <span className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`inline-block w-4 h-4 rounded-sm border ${
                    n <= count
                      ? "bg-[var(--primary-color)] border-[var(--primary-color)]"
                      : "bg-muted border-border"
                  }`}
                />
              ))}
            </span>
            {horario && <span className="text-xs text-muted-foreground">{horario}</span>}
          </span>
        )
      },
    },
    {
      field: "fecha_de_nacimiento", headerName: "Nacimiento", flex: 0.9, minWidth: 120,
      renderCell: ({ value }) => (
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(value || "")}
        </span>
      ),
    },
    {
      field: "fecha_de_inicio", headerName: "Inicio", flex: 0.8, minWidth: 110,
      renderCell: ({ value }) => formatDate(value || ""),
    },
    {
      field: "status", headerName: "Estado", flex: 0.8, minWidth: 100,
      renderCell: ({ value, row }) => (
        <span style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          <StatusBadge status={value} fechaVencimiento={row.fecha_de_vencimiento} style={{ width: "90%", justifyContent: "center", padding: "6px 0" }} />
        </span>
      ),
    },
    {
      field: "telefono", headerName: "WA", width: 70, sortable: false,
      renderCell: ({ value }) => (
        <span className="flex items-center justify-center w-full h-full">
          <a href={`https://wa.me/${value?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-[85%] h-[75%] rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors">
            <MessageSquare className="h-4 w-4" />
          </a>
        </span>
      ),
    },
    {
      field: "plan", headerName: "Plan", width: 70, sortable: false,
      renderCell: ({ value }) => (
        <span className="flex items-center justify-center w-full h-full">
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-[85%] h-[75%] rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors">
            <FileText className="h-4 w-4" />
          </a>
        </span>
      ),
    },
    {
      field: "planApp", headerName: "Plan App", width: 90, sortable: false,
      renderCell: ({ row }) => {
        const enabled = alumnosConPlan.has(row.id)
        return (
          <span className="flex items-center justify-center w-full h-full">
            <button
              onClick={() => enabled && handleOpenPlanApp(row as Student)}
              disabled={!enabled}
              className="flex items-center justify-center w-[85%] h-[75%] rounded-md bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ClipboardList className="h-4 w-4" />
            </button>
          </span>
        )
      },
    },
    {
      field: "progreso", headerName: "Progreso", width: 90, sortable: false,
      renderCell: ({ row }) => {
        const enabled = alumnosConPlan.has(row.id)
        return (
          <span className="flex items-center justify-center w-full h-full">
            <button
              onClick={() => enabled && handleProgreso(row as Student)}
              disabled={!enabled}
              className="flex items-center justify-center w-[85%] h-[75%] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <TrendingUp className="h-4 w-4" />
            </button>
          </span>
        )
      },
    },
    {
      field: "acciones", headerName: "", width: 50, sortable: false,
      renderCell: ({ row }) => (
        <span className="flex items-center justify-center w-full h-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(row as Student)} className="text-blue-600 cursor-pointer">
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(row as Student)} className="text-red-600 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ),
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 w-full md:w-96">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar alumnos..."
              className="w-full pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 md:hidden">
            {[null, "Activo", "Vencido", "Indefinido"].map((f) => (
              <button
                key={f ?? "todos"}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  statusFilter === f
                    ? "bg-[var(--primary-color)] text-white border-[var(--primary-color)]"
                    : "bg-background text-muted-foreground border-border"
                }`}
              >
                {f ?? "Todos"}
              </button>
            ))}
          </div>
        </div>
        <Button
          size="sm"
          className="fixed bottom-24 right-4 w-16 h-16 rounded-full gap-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] active:scale-90 lg:active:scale-95 transition-transform duration-100 lg:static lg:h-10 lg:w-[150px] lg:py-2 lg:rounded-md"
          onClick={() => setIsAddStudentOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Nuevo alumno</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {sortedStudents.map((student) => (
              <StudentMobileCard key={student.id} student={student} onEdit={handleEdit} onDelete={handleDelete} onProgreso={handleProgreso} onPlanApp={handleOpenPlanApp} hasPlan={alumnosConPlan.has(student.id)} />
            ))}
          </div>
          <div className="hidden lg:block">
            <GenericDataGrid rows={sortedStudents} columns={studentsColumns} initialSortModel={[]} columnVisibilityModel={columnVisibilityModel} />
          </div>
        </>
      )}

      <StudentProgresoDialog student={selectedStudent} open={isProgresoOpen} onOpenChange={setIsProgresoOpen} />
      <AddStudentDialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen} onStudentAdded={() => {}} />
      {selectedStudent && (
        <>
          <EditStudentDialog
            open={isEditStudentOpen}
            onOpenChange={setIsEditStudentOpen}
            student={selectedStudent}
            onStudentUpdated={() => {}}
          />
          <DeleteStudentDialog
            open={isDeleteStudentOpen}
            onOpenChange={setIsDeleteStudentOpen}
            student={{ id: selectedStudent.id.toString(), name: selectedStudent.nombre }}
            onStudentDeleted={() => {}}
          />
        </>
      )}
    </>
  )
}
