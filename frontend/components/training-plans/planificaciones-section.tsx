"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader } from "@/components/ui/loader"
import {
  Plus, Loader2, ClipboardList, Pencil, Trash2,
  CheckCircle2, Circle, AlertCircle, Search, X, Eye
} from "lucide-react"
import { PlanBuilder } from "./plan-builder"
import type { PlanificacionListItem } from "@/types/planificaciones"

interface Student { id: number; nombre: string }

const ESTADO_CONFIG: Record<string, { label: string; icon: React.ReactNode; badgeClass: string; accentClass: string }> = {
  borrador: {
    label: "Borrador",
    icon: <Circle className="h-3 w-3" />,
    badgeClass: "text-muted-foreground bg-muted/80 border border-border/50",
    accentClass: "bg-muted",
  },
  activo: {
    label: "Activo",
    icon: <CheckCircle2 className="h-3 w-3" />,
    badgeClass: "text-[var(--primary-color)] bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20",
    accentClass: "bg-[var(--primary-color)]",
  },
  finalizado: {
    label: "Finalizado",
    icon: <AlertCircle className="h-3 w-3" />,
    badgeClass: "text-orange-600 bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
    accentClass: "bg-orange-400",
  },
}

export function PlanificacionesSection({ initialPlanId }: { initialPlanId?: number | null }) {
  const queryClient = useQueryClient()
  const [activePlanId, setActivePlanId] = useState<number | null>(initialPlanId ?? null)

  useEffect(() => {
    if (initialPlanId != null) setActivePlanId(initialPlanId)
  }, [initialPlanId])
  const [createOpen, setCreateOpen] = useState(false)
  const [newAlumnoId, setNewAlumnoId] = useState<string>("")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [planToDelete, setPlanToDelete] = useState<{ id: number; nombre: string } | null>(null)
  const [search, setSearch] = useState("")

  const { data: planificaciones = [], isLoading } = useQuery<PlanificacionListItem[]>({
    queryKey: queryKeys.planificaciones,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones`)
      return res.data
    },
  })

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: queryKeys.students,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllStudents`)
      return res.data
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return planificaciones
    return planificaciones.filter((p) => {
      const alumno = students.find((s) => s.id === p.alumno_id)
      return (
        p.nombre.toLowerCase().includes(q) ||
        (alumno?.nombre.toLowerCase().includes(q) ?? false)
      )
    })
  }, [search, planificaciones, students])

  const handleCreate = async () => {
    if (!newAlumnoId) return

    setCreating(true)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones`, {
        alumno_id: Number(newAlumnoId),
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
      setCreateOpen(false)
      setNewAlumnoId("")
      setActivePlanId(res.data.id)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = (id: number, nombre: string) => {
    setPlanToDelete({ id, nombre })
  }

  const confirmDelete = async () => {
    if (!planToDelete) return
    const { id } = planToDelete
    setDeletingId(id)
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planificaciones/${id}`)
      await queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
      setPlanToDelete(null)
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  // ─── Vista del builder ───
  if (activePlanId !== null) {
    return (
      <PlanBuilder
        key={activePlanId}
        planId={activePlanId}
        onBack={() => {
          setActivePlanId(null)
          queryClient.invalidateQueries({ queryKey: queryKeys.planificaciones })
        }}
      />
    )
  }

  // ─── Lista de planificaciones ───
  if (isLoading) return <Loader />

  const borradores = filtered.filter((p) => p.estado === "borrador")
  const activas = filtered.filter((p) => p.estado === "activo")
  const finalizadas = filtered.filter((p) => p.estado === "finalizado")
  const isSearching = search.trim().length > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold flex-1">Planificaciones</h2>
        <Button
          onClick={() => {
            setCreateOpen(true)
            if (students.length > 0) setNewAlumnoId(students[0].id.toString())
          }}
          className="gap-2 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
        >
          <Plus className="h-4 w-4" />
          Nueva planificación
        </Button>
      </div>

      {/* Buscador */}
      {planificaciones.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por alumno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Sin resultados */}
      {planificaciones.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center space-y-3">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <div>
            <p className="font-medium">Sin planificaciones</p>
            <p className="text-sm text-muted-foreground">Creá la primera planificación para un alumno.</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center space-y-2">
          <Search className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay resultados para <span className="font-medium">"{search}"</span></p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Si está buscando, muestra flat sin grupos */}
          {isSearching ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  students={students}
                  deletingId={deletingId}
                  onOpen={setActivePlanId}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <>
              {activas.length > 0 && (
                <PlanGroup title="Activas" count={activas.length} plans={activas} students={students}
                  deletingId={deletingId} onOpen={setActivePlanId} onDelete={handleDelete} />
              )}
              {borradores.length > 0 && (
                <PlanGroup title="Borradores" count={borradores.length} plans={borradores} students={students}
                  deletingId={deletingId} onOpen={setActivePlanId} onDelete={handleDelete} />
              )}
              {finalizadas.length > 0 && (
                <PlanGroup title="Finalizadas" count={finalizadas.length} plans={finalizadas} students={students}
                  deletingId={deletingId} onOpen={setActivePlanId} onDelete={handleDelete} />
              )}
            </>
          )}
        </div>
      )}

      {/* Modal de creación */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <h2 className="text-base font-semibold mb-3">Nueva planificación</h2>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Alumno *</Label>
              <Select value={newAlumnoId} onValueChange={setNewAlumnoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar alumno" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newAlumnoId}
              className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear y abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!planToDelete} onOpenChange={(open) => { if (!open) setPlanToDelete(null) }}>
        <DialogContent className="max-w-sm">
          <h2 className="text-base font-semibold">Eliminar planificación</h2>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés eliminar la planificación de <span className="font-medium text-foreground">{planToDelete?.nombre}</span>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="flex-row gap-2 sm:gap-2 mt-2">
            <Button variant="outline" className="w-1/2" onClick={() => setPlanToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="w-1/2"
              onClick={confirmDelete}
              disabled={deletingId === planToDelete?.id}
            >
              {deletingId === planToDelete?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Grupo de planes ──────────────────────────────────────────────────────────
function PlanGroup({
  title, count, plans, students, deletingId, onOpen, onDelete,
}: {
  title: string
  count: number
  plans: PlanificacionListItem[]
  students: Student[]
  deletingId: number | null
  onOpen: (id: number) => void
  onDelete: (id: number, nombre: string) => void
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
        <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            students={students}
            deletingId={deletingId}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Card individual ──────────────────────────────────────────────────────────
function PlanCard({
  plan, students, deletingId, onOpen, onDelete,
}: {
  plan: PlanificacionListItem
  students: Student[]
  deletingId: number | null
  onOpen: (id: number) => void
  onDelete: (id: number, nombre: string) => void
}) {
  const alumno = students.find((s) => s.id === plan.alumno_id)
  const estado = ESTADO_CONFIG[plan.estado] ?? ESTADO_CONFIG.borrador
  const hojaVisible = plan.planificacion_hojas?.find((h) => h.id === plan.hoja_activa_id)

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-muted/20 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary-color)]/35 hover:shadow-lg flex flex-col">
      <div className={`h-1 w-full ${estado.accentClass}`} />
      <div className="pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full bg-[var(--primary-color)]/8 blur-2xl" />

      <div className="relative flex flex-col gap-3.5 p-4 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 h-8 w-8 rounded-xl bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-[var(--primary-color)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-[var(--primary-color)] transition-colors">
                {alumno?.nombre ?? "Sin alumno"}
              </p>
            </div>
          </div>
          <span className={`shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${estado.badgeClass}`}>
            {estado.icon}
            {estado.label}
          </span>
        </div>

        {hojaVisible && (
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-50/90 dark:bg-yellow-900/25 border border-yellow-200 dark:border-yellow-800 rounded-full px-2.5 py-1 w-fit">
            <Eye className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[190px]">Alumno ve: {hojaVisible.nombre}</span>
          </div>
        )}

        <div className="mt-auto" />
      </div>

      <div className="flex items-center gap-2 px-4 pb-4 pt-1">
        <Button
          size="sm"
          onClick={() => onOpen(plan.id)}
          className="flex-1 h-8 text-xs gap-1.5 bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-white border-0 shadow-none"
          variant="outline"
        >
          <Pencil className="h-3 w-3" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={() => onDelete(plan.id, alumno?.nombre ?? plan.nombre)}
          disabled={deletingId === plan.id}
        >
          {deletingId === plan.id
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />
          }
        </Button>
      </div>
    </div>
  )
}
