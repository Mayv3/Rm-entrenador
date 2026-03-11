"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Loader2 } from "lucide-react"
import axios from "axios"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface DeletePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: { id: number; nombre: string }
}

export function DeletePlanDialog({ open, onOpenChange, plan }: DeletePlanDialogProps) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      const response = await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planes/${plan.id}`)
      if (response.status === 200 || response.status === 201) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.planes })
        onOpenChange(false)
      }
    } catch (error) {
      console.error("Error al eliminar el plan:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[420px] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl">
        <DialogTitle className="sr-only">Eliminar plan</DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/40">
            <Trash2 className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Eliminar plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Esta acción no se puede deshacer</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5 text-sm text-muted-foreground">
          ¿Estás seguro de que querés eliminar el plan <strong className="text-foreground">{plan?.nombre}</strong>?
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/40 flex flex-row gap-3">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="button" size="sm" className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
