"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { format, isSameDay, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Loader2, Plus, Trash2, MessageSquare, Clock } from "lucide-react"
import { queryKeys } from "@/lib/query-keys"

interface Student {
  id: number
  nombre: string
  telefono?: string | null
}

interface Turno {
  id: number
  alumno_id: number
  fecha: string
  hora: string
  notas: string | null
  alumnos: { id: number; nombre: string; telefono: string | null } | null
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  students: Student[]
}

function mensajeTurno(fecha: string, hora: string) {
  const fechaFmt = format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })
  return `¡Hola! Te recuerdo que tenés turno agendado de antropometría para el ${fechaFmt} a las ${hora.slice(0, 5)} hs. Nos vemos!`
}

export function AntroAgendaDialog({ open, onOpenChange, students }: Props) {
  const queryClient = useQueryClient()
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const [showForm, setShowForm] = useState(false)
  const [alumnoId, setAlumnoId] = useState("")
  const [hora, setHora] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: turnos = [], isLoading } = useQuery<Turno[]>({
    queryKey: queryKeys.turnos,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/turnos`)
      return res.data
    },
    enabled: open,
  })

  const diasConTurno = useMemo(
    () => turnos.map((t) => parseISO(t.fecha)),
    [turnos]
  )

  const turnosDelDia = useMemo(
    () => turnos
      .filter((t) => isSameDay(parseISO(t.fecha), selectedDay))
      .sort((a, b) => a.hora.localeCompare(b.hora)),
    [turnos, selectedDay]
  )

  const resetForm = () => {
    setShowForm(false)
    setAlumnoId("")
    setHora("")
  }

  const handleAsignar = async () => {
    if (!alumnoId || !hora) return
    setSaving(true)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/turnos`, {
        alumno_id: alumnoId,
        fecha: format(selectedDay, "yyyy-MM-dd"),
        hora,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.turnos })
      resetForm()
    } catch (e) {
      console.error("Error al asignar turno:", e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/turnos/${id}`)
      await queryClient.invalidateQueries({ queryKey: queryKeys.turnos })
    } catch (e) {
      console.error("Error al eliminar turno:", e)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="inset-0 h-[100dvh] w-full max-w-none max-h-none translate-x-0 translate-y-0 gap-3 overflow-hidden rounded-none border-0 px-5 py-6 shadow-none data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=open]:zoom-in-100 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90dvh] sm:w-[min(100%-2rem,34rem)] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:overflow-y-auto sm:rounded-2xl sm:px-6 lg:flex lg:h-[calc(100dvh-2rem)] lg:max-h-[48rem] lg:w-[min(100%-4rem,58rem)] lg:max-w-[58rem] lg:flex-col lg:p-8">
        <DialogHeader className="shrink-0 text-left">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => { resetForm(); onOpenChange(false) }}
              aria-label="Volver"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DialogTitle className="text-xl tracking-tight">Agenda de turnos</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(15rem,0.75fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:items-stretch lg:gap-x-8 lg:gap-y-5">
          <div className="w-full shrink-0 lg:row-span-2">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={(d) => { if (d) { setSelectedDay(d); resetForm() } }}
              locale={es}
              modifiers={{ hasTurno: diasConTurno }}
              modifiersClassNames={{ hasTurno: "!bg-emerald-500 !text-emerald-950 font-semibold hover:!bg-emerald-400 focus:!bg-emerald-400" }}
              className="w-full p-0"
              classNames={{
                months: "w-full",
                month: "w-full space-y-2",
                caption: "relative flex h-9 items-center justify-center lg:h-11",
                caption_label: "text-sm font-semibold capitalize lg:text-base",
                nav: "flex items-center gap-1",
                nav_button: "flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9 lg:w-9",
                nav_button_previous: "absolute left-0",
                nav_button_next: "absolute right-0",
                table: "w-full border-collapse",
                head_row: "flex w-full",
                head_cell: "flex-1 pb-1 text-center text-xs font-medium text-muted-foreground lg:pb-2 lg:text-sm",
                row: "mt-1 flex w-full lg:mt-2",
                cell: "flex h-10 flex-1 items-center justify-center p-0 text-center text-sm lg:h-12 lg:text-base",
                day: "flex h-9 w-9 items-center justify-center rounded-full p-0 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-11 lg:w-11 lg:text-base",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-muted text-foreground",
                day_outside: "text-muted-foreground/55",
                day_disabled: "text-muted-foreground opacity-50",
                day_hidden: "invisible",
              }}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-muted/40 lg:col-start-2 lg:row-span-2">
            <div className="flex shrink-0 items-center gap-3 px-4 py-3 lg:min-h-0 lg:gap-2 lg:flex-col lg:items-stretch lg:justify-center lg:px-4 lg:py-3">
              <p className="min-w-0 flex-1 text-sm font-semibold capitalize leading-snug lg:flex-none">
                {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
              </p>
              {!showForm && (
                <Button size="sm" className="h-10 shrink-0 rounded-xl px-4 lg:hidden" onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4" /> Agendar
                </Button>
              )}
            </div>
            <div className="mx-4 h-px shrink-0 bg-border/50" />

            <div className={`${showForm ? "flex" : "hidden lg:flex"} shrink-0 flex-col gap-3 p-4`}>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Alumno</Label>
                <Select value={alumnoId} onValueChange={setAlumnoId}>
                  <SelectTrigger className="border-0 bg-background shadow-none">
                    <SelectValue placeholder="Seleccionar alumno" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Hora</Label>
                  <Input className="border-0 bg-background shadow-none" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
                <Button variant="ghost" size="sm" className="h-10" onClick={resetForm}>Cancelar</Button>
                <Button size="sm" className="h-10" onClick={handleAsignar} disabled={saving || !alumnoId || !hora}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </div>
            <div className={`${showForm ? "block" : "hidden lg:block"} mx-4 h-px shrink-0 bg-border/50`} />

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : turnosDelDia.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">Sin turnos este día</p>
            ) : (
              <div className="flex flex-col gap-2 lg:gap-1">{turnosDelDia.map((t) => {
                const nombre = t.alumnos?.nombre ?? "Alumno"
                const telefono = t.alumnos?.telefono
                return (
                  <div key={t.id} className="flex items-center gap-2 rounded-2xl bg-muted/40 p-2.5 lg:gap-1.5 lg:rounded-xl lg:p-1.5">
                    <div className="flex w-14 shrink-0 items-center gap-1.5 text-sm font-semibold lg:w-12 lg:gap-1 lg:text-xs">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground lg:h-3 lg:w-3" />
                      {t.hora.slice(0, 5)}
                    </div>
                    <span className="flex-1 truncate text-sm lg:text-xs">{nombre}</span>
                    {telefono && (
                      <a
                        href={`https://wa.me/${telefono.replace(/\D/g, "")}?text=${encodeURIComponent(mensajeTurno(t.fecha, t.hora))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-500 text-white transition-colors hover:bg-green-600 lg:h-7 lg:w-7 lg:rounded-lg"
                      >
                        <MessageSquare className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                      </a>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive lg:h-7 lg:w-7"
                      onClick={() => handleDelete(t.id)}
                      disabled={deletingId === t.id}
                    >
                      {deletingId === t.id ? <Loader2 className="h-4 w-4 animate-spin lg:h-3.5 lg:w-3.5" /> : <Trash2 className="h-4 w-4 lg:h-3.5 lg:w-3.5" />}
                    </Button>
                  </div>
                )
              })}</div>
            )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
