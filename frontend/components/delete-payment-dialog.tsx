"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import axios from "axios"
import { AlertTriangle } from "lucide-react"

interface Payment {
  id: string
  studentName: string
  amount: number
}

interface DeletePaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: Payment
  onPaymentDeleted: () => void
}

export function DeletePaymentDialog({ open, onOpenChange, payment, onPaymentDeleted }: DeletePaymentDialogProps) {
  const handleDelete = () => {

    const deletePayment = async ()=>{
      try {
        const response = await axios.delete(
          `${process.env.NEXT_PUBLIC_URL_BACKEND}/payment/${payment.id}`, 
        )
  
        if (response.status === 200 || response.status === 201) {
          onOpenChange(false)
          onPaymentDeleted()
        }
      } catch (error) {
        console.error("Error al eliminar el pago:", error)
      }
    }
    
    deletePayment()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirmar Eliminación
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Esto eliminará permanentemente el pago de{" "}
            <strong>{payment.studentName}</strong> por <strong>${payment.monto.toLocaleString()}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar este registro de pago? Esta acción no puede revertirse.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

