"use client"

import { useMemo, useState } from "react"
import { History, Search, X, Pencil, Trash2, Check } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader } from "@/components/ui/loader"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatDate } from "@/lib/payment-utils"
import { useDialogBackButton } from "@/hooks/use-dialog-back-button"
import { usePlanes } from "@/hooks/use-planes"
import axios from "axios"

interface HistorialEntry {
  id: number
  pago_id: number
  alumno_id: number
  nombre: string
  monto: number
  fecha_de_pago: string | null
  fecha_de_vencimiento: string
  modalidad: string
  changed_at: string
}

type SortKey = "changed_at_desc" | "changed_at_asc" | "monto_desc" | "monto_asc" | "nombre_asc" | "nombre_desc"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "changed_at_desc", label: "Más reciente primero" },
  { value: "changed_at_asc", label: "Más antiguo primero" },
  { value: "monto_desc", label: "Mayor monto" },
  { value: "monto_asc", label: "Menor monto" },
  { value: "nombre_asc", label: "Nombre A→Z" },
  { value: "nombre_desc", label: "Nombre Z→A" },
]

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentHistoryGlobalDialog({ open, onOpenChange }: Props) {
  useDialogBackButton(open, onOpenChange)
  const queryClient = useQueryClient()
  const { data: planes = [] } = usePlanes()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("changed_at_desc")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ monto: "", fecha_de_pago: "", fecha_de_vencimiento: "", modalidad: "" })
  const [saving, setSaving] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.allPaymentHistory })
    queryClient.invalidateQueries({ queryKey: ["paymentHistory"] })
    queryClient.invalidateQueries({ queryKey: queryKeys.payments })
  }

  const handlePlanChange = (nombre: string) => {
    const plan = planes.find((p) => p.nombre === nombre)
    setEditForm((prev) => ({
      ...prev,
      modalidad: nombre,
      monto: plan?.precio != null ? String(plan.precio) : prev.monto,
    }))
  }

  const startEdit = (entry: HistorialEntry) => {
    setDeletingId(null)
    setEditingId(entry.id)
    setEditForm({ monto: String(entry.monto), fecha_de_pago: entry.fecha_de_pago ?? "", fecha_de_vencimiento: entry.fecha_de_vencimiento, modalidad: entry.modalidad })
  }

  const handleSave = async (id: number) => {
    setSaving(true)
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/payment/history/${id}`, editForm)
      invalidate()
      setEditingId(null)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    setSaving(true)
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/payment/history/${id}`)
      invalidate()
      setDeletingId(null)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const { data: history = [], isLoading } = useQuery({
    queryKey: queryKeys.allPaymentHistory,
    queryFn: () =>
      axios
        .get<HistorialEntry[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/payments/history`)
        .then((r) => r.data),
    enabled: open,
  })

  const filtered = useMemo(() => {
    let result = [...history]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((e) => e.nombre.toLowerCase().includes(q))
    }

    result.sort((a, b) => {
      switch (sortKey) {
        case "changed_at_desc": return new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
        case "changed_at_asc":  return new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
        case "monto_desc":      return Number(b.monto) - Number(a.monto)
        case "monto_asc":       return Number(a.monto) - Number(b.monto)
        case "nombre_asc":      return a.nombre.localeCompare(b.nombre)
        case "nombre_desc":     return b.nombre.localeCompare(a.nombre)
        default: return 0
      }
    })

    return result
  }, [history, search, sortKey])

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, e) => sum + Number(e.monto), 0)
    return { total, count: filtered.length }
  }, [filtered])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] !max-w-4xl p-0 gap-0 h-[92vh] flex flex-col rounded-2xl overflow-hidden">
        <DialogTitle className="sr-only">Historial global de pagos</DialogTitle>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary-color)]/10">
            <History className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold leading-none">Historial global de pagos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Registro de todas las renovaciones</p>
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b shrink-0 text-sm">
          <span className="text-muted-foreground">Renovaciones: <span className="font-semibold text-foreground">{stats.count}</span></span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Recaudado: <span className="font-semibold text-foreground">${stats.total.toLocaleString("es-AR")}</span></span>
        </div>

        {/* ── Barra de búsqueda + filtros ─────────────────────────── */}
        <div className="px-4 py-2 shrink-0 border-b">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por alumno..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-8 w-8 md:w-[190px] shrink-0 text-xs [&>span]:hidden md:[&>span]:inline [&>svg]:mx-auto md:[&>svg]:ml-auto md:[&>svg]:mr-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Resultados ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <History className="w-8 h-8 opacity-30" />
              <p className="text-sm">Sin resultados</p>
            </div>
          ) : (
            <>
              {/* Desktop: tabla */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="px-4 py-2.5 font-medium">Alumno</th>
                      <th className="px-4 py-2.5 font-medium">Plan</th>
                      <th className="px-4 py-2.5 font-medium">Monto</th>
                      <th className="px-4 py-2.5 font-medium">Fecha de pago</th>
                      <th className="px-4 py-2.5 font-medium">Vencimiento</th>
                      <th className="px-4 py-2.5 font-medium">Registrado</th>
                      <th className="px-4 py-2.5 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((entry) => {
                      if (editingId === entry.id) {
                        return (
                          <tr key={entry.id} className="bg-muted/20">
                            <td className="px-4 py-2 font-medium text-muted-foreground">{entry.nombre}</td>
                            <td className="px-2 py-2">
                              <Select value={editForm.modalidad} onValueChange={handlePlanChange}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Plan" /></SelectTrigger>
                                <SelectContent>
                                  {planes.map((p) => (
                                    <SelectItem key={p.id} value={p.nombre} className="text-xs">
                                      {p.nombre}{p.precio != null && <span className="ml-1.5 text-muted-foreground">${p.precio.toLocaleString("es-AR")}</span>}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-2"><Input type="number" value={editForm.monto} onChange={(e) => setEditForm((p) => ({ ...p, monto: e.target.value }))} className="h-7 text-xs" /></td>
                            <td className="px-2 py-2"><Input type="date" value={editForm.fecha_de_pago} onChange={(e) => setEditForm((p) => ({ ...p, fecha_de_pago: e.target.value }))} className="h-7 text-xs" /></td>
                            <td className="px-2 py-2"><Input type="date" value={editForm.fecha_de_vencimiento} onChange={(e) => setEditForm((p) => ({ ...p, fecha_de_vencimiento: e.target.value }))} className="h-7 text-xs" /></td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateTime(entry.changed_at)}</td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1">
                                <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleSave(entry.id)} disabled={saving} className="p-1 rounded bg-[var(--primary-color)] text-white"><Check className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      if (deletingId === entry.id) {
                        return (
                          <tr key={entry.id} className="bg-red-50 dark:bg-red-950/20">
                            <td colSpan={6} className="px-4 py-3 text-sm text-red-600">¿Eliminar este registro de <strong>{entry.nombre}</strong>?</td>
                            <td className="px-2 py-3">
                              <div className="flex gap-1">
                                <button onClick={() => setDeletingId(null)} className="px-2 py-1 rounded border text-xs text-muted-foreground">No</button>
                                <button onClick={() => handleDelete(entry.id)} disabled={saving} className="px-2 py-1 rounded bg-red-500 text-white text-xs">Sí</button>
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={entry.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-4 py-3 font-medium">{entry.nombre}</td>
                          <td className="px-4 py-3">{entry.modalidad}</td>
                          <td className="px-4 py-3 font-medium">${Number(entry.monto).toLocaleString("es-AR")}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.fecha_de_pago)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.fecha_de_vencimiento)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(entry.changed_at)}</td>
                          <td className="px-2 py-3">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEdit(entry)} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { setEditingId(null); setDeletingId(entry.id) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: lista compacta */}
              <div className="md:hidden divide-y divide-border">
                {filtered.map((entry) => {
                  if (editingId === entry.id) {
                    return (
                      <div key={entry.id} className="px-4 py-3 flex flex-col gap-2 bg-muted/20">
                        <p className="text-sm font-medium">{entry.nombre}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={editForm.modalidad} onValueChange={handlePlanChange}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Plan" /></SelectTrigger>
                            <SelectContent>
                              {planes.map((p) => (
                                <SelectItem key={p.id} value={p.nombre} className="text-xs">
                                  {p.nombre}{p.precio != null && <span className="ml-1.5 text-muted-foreground">${p.precio.toLocaleString("es-AR")}</span>}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input type="number" value={editForm.monto} onChange={(e) => setEditForm((p) => ({ ...p, monto: e.target.value }))} placeholder="Monto" className="h-8 text-xs" />
                          <Input type="date" value={editForm.fecha_de_pago} onChange={(e) => setEditForm((p) => ({ ...p, fecha_de_pago: e.target.value }))} className="h-8 text-xs" />
                          <Input type="date" value={editForm.fecha_de_vencimiento} onChange={(e) => setEditForm((p) => ({ ...p, fecha_de_vencimiento: e.target.value }))} className="h-8 text-xs" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingId(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border"><X className="h-3 w-3" /> Cancelar</button>
                          <button onClick={() => handleSave(entry.id)} disabled={saving} className="flex items-center gap-1 text-xs text-white bg-[var(--primary-color)] px-2 py-1 rounded"><Check className="h-3 w-3" /> Guardar</button>
                        </div>
                      </div>
                    )
                  }
                  if (deletingId === entry.id) {
                    return (
                      <div key={entry.id} className="flex items-center justify-between px-4 py-3 gap-3 bg-red-50 dark:bg-red-950/20">
                        <p className="text-sm text-red-600">¿Eliminar registro de <strong>{entry.nombre}</strong>?</p>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setDeletingId(null)} className="text-xs text-muted-foreground px-2 py-1 rounded border">No</button>
                          <button onClick={() => handleDelete(entry.id)} disabled={saving} className="text-xs text-white bg-red-500 px-2 py-1 rounded">Sí</button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={entry.id} className="flex items-center justify-between px-4 py-3 gap-3 group">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{entry.nombre}</p>
                        <p className="text-xs text-muted-foreground">{entry.modalidad} · {formatDateTime(entry.changed_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="font-semibold text-sm">${Number(entry.monto).toLocaleString("es-AR")}</p>
                          <p className="text-xs text-muted-foreground">hasta {formatDate(entry.fecha_de_vencimiento)}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(entry)} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { setEditingId(null); setDeletingId(entry.id) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Footer con conteo ────────────────────────────────────── */}
        <div className="px-5 py-2.5 border-t bg-muted/40 shrink-0">
          <p className="text-xs text-muted-foreground">
            {filtered.length} de {history.length} registros
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
