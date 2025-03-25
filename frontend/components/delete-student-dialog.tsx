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
import { promises } from "dns"
import { AlertTriangle } from "lucide-react"
import { useRouter } from "next/router"
import { useState } from "react"

interface Student {
  id: string
  name: string
}

interface DeleteStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: Student
  onStudentDeleted?: () => Promise<void> | void
}


export function DeleteStudentDialog({ open, onOpenChange, student, onStudentDeleted }: DeleteStudentDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${student.id}`)
      
      if (onStudentDeleted) {
        onStudentDeleted()
      }

      
      onOpenChange(false)
    } catch (error) {
      console.error("Error eliminando estudiante:", error)
    } finally {
      setIsDeleting(false)
    }
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
            Esta acción no se puede deshacer. Esto eliminará permanentemente al alumno <strong>{student.name}</strong> y
            todos sus datos asociados.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar a este alumno? Todos los datos relacionados con pagos, asistencias y
            planes de entrenamiento también serán eliminados.
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

