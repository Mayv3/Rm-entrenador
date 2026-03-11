"use client"

import { useState } from "react"
import { History, Pencil, Trash2, Check, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader } from "@/components/ui/loader"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatDate } from "@/lib/payment-utils"
import { useDialogBackButton } from "@/hooks/use-dialog-back-button"
import { usePlanes } from "@/hooks/use-planes"
import axios from "axios"

interface PaymentHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: { id: number; nombre: string } | null
}

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

function formatDateTime(isoString: string) {
  const d = new Date(isoString)
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export function PaymentHistoryDialog({ open, onOpenChange, payment }: PaymentHistoryDialogProps) {
  useDialogBackButton(open, onOpenChange)
  const queryClient = useQueryClient()

  const { data: planes = [] } = usePlanes()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ monto: "", fecha_de_pago: "", fecha_de_vencimiento: "", modalidad: "" })
  const [saving, setSaving] = useState(false)

  const handlePlanChange = (nombre: string) => {
    const plan = planes.find((p) => p.nombre === nombre)
    setEditForm((prev) => ({
      ...prev,
      modalidad: nombre,
      monto: plan?.precio != null ? String(plan.precio) : prev.monto,
    }))
  }

  const queryKey = payment ? queryKeys.paymentHistory(payment.id) : ["paymentHistory", null]

  const { data: history = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      axios.get<HistorialEntry[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/payment/${payment!.id}/history`).then((r) => r.data),
    enabled: open && !!payment,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKey as any })
    queryClient.invalidateQueries({ queryKey: queryKeys.allPaymentHistory })
    queryClient.invalidateQueries({ queryKey: queryKeys.payments })
  }

  const startEdit = (entry: HistorialEntry) => {
    setDeletingId(null)
    setEditingId(entry.id)
    setEditForm({
      monto: String(entry.monto),
      fecha_de_pago: entry.fecha_de_pago ?? "",
      fecha_de_vencimiento: entry.fecha_de_vencimiento,
      modalidad: entry.modalidad,
    })
  }

  const handleSave = async (id: number) => {
    setSaving(true)
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/payment/history/${id}`, editForm)
      invalidate()
      setEditingId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setSaving(true)
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/payment/history/${id}`)
      invalidate()
      setDeletingId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[560px] p-0 gap-0 overflow-x-hidden h-auto max-h-[80vh] flex flex-col rounded-2xl">
        <DialogTitle className="sr-only">Historial de pagos</DialogTitle>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary-color)]/10">
            <History className="w-4 h-4 text-[var(--primary-color)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Historial de pagos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{payment?.nombre}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader /></div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sin registros de cambios aún.</p>
          ) : (
            <div className="divide-y divide-border">
              {history.map((entry) => {
                if (editingId === entry.id) {
                  return (
                    <div key={entry.id} className="px-5 py-3 flex flex-col gap-2">
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
                        <Input
                          type="number"
                          value={editForm.monto}
                          onChange={(e) => setEditForm((p) => ({ ...p, monto: e.target.value }))}
                          placeholder="Monto"
                          className="h-8 text-xs"
                        />
                        <Input
                          type="date"
                          value={editForm.fecha_de_pago}
                          onChange={(e) => setEditForm((p) => ({ ...p, fecha_de_pago: e.target.value }))}
                          className="h-8 text-xs"
                        />
                        <Input
                          type="date"
                          value={editForm.fecha_de_vencimiento}
                          onChange={(e) => setEditForm((p) => ({ ...p, fecha_de_vencimiento: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border">
                          <X className="h-3 w-3" /> Cancelar
                        </button>
                        <button onClick={() => handleSave(entry.id)} disabled={saving} className="flex items-center gap-1 text-xs text-white bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 px-2 py-1 rounded">
                          <Check className="h-3 w-3" /> Guardar
                        </button>
                      </div>
                    </div>
                  )
                }

                if (deletingId === entry.id) {
                  return (
                    <div key={entry.id} className="flex items-center justify-between px-5 py-3 gap-3 bg-red-50 dark:bg-red-950/20">
                      <p className="text-sm text-red-600">¿Eliminar este registro?</p>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => setDeletingId(null)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border">
                          No
                        </button>
                        <button onClick={() => handleDelete(entry.id)} disabled={saving} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded">
                          Sí, eliminar
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={entry.id} className="flex items-center justify-between px-5 py-3 gap-3 group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{entry.modalidad}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.changed_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold">${Number(entry.monto).toLocaleString("es-AR")}</p>
                        <p className="text-xs text-muted-foreground">hasta {formatDate(entry.fecha_de_vencimiento)}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(entry)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setEditingId(null); setDeletingId(entry.id) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
