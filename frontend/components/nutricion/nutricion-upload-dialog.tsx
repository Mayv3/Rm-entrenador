"use client"

import { useState, useRef } from "react"
import { PDFDocument } from "pdf-lib"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase-client"
import { queryKeys } from "@/lib/query-keys"
import { Input } from "@/components/ui/input"
import { Upload, FileText, Trash2, Eye, Loader2, X, Pencil, Check, Link } from "lucide-react"

interface Student {
  id: number
  nombre: string
  habitos_link?: string | null
}

interface NutricionRecord {
  id: number
  alumno_id: number
  nombre_archivo: string
  pdf_path: string
  created_at: string
  habitos_link: string | null
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  alumno: Student
}

async function optimizePdf(file: File): Promise<{ file: File; info: string | null }> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true })
    const optimized = new File([pdfBytes], file.name, { type: "application/pdf" })
    if (optimized.size < file.size) {
      const reduction = Math.round((1 - optimized.size / file.size) * 100)
      const toKB = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`
      return { file: optimized, info: `Optimizado: ${toKB(file.size)} → ${toKB(optimized.size)} (-${reduction}%)` }
    }
    return { file, info: null }
  } catch {
    return { file, info: null }
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function NutricionUploadDialog({ open, onOpenChange, alumno }: Props) {
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [habitosLink, setHabitosLink] = useState("")
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmRecord, setConfirmRecord] = useState<NutricionRecord | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingNombre, setEditingNombre] = useState("")
  const [savingId, setSavingId] = useState<number | null>(null)
  const [editingHabitosId, setEditingHabitosId] = useState<number | null>(null)
  const [editingHabitosLink, setEditingHabitosLink] = useState("")
  const [savingHabitosId, setSavingHabitosId] = useState<number | null>(null)
  const [habitosAlumno, setHabitosAlumno] = useState(alumno.habitos_link ?? "")
  const [editingHabitosAlumno, setEditingHabitosAlumno] = useState(false)
  const [savingHabitosAlumno, setSavingHabitosAlumno] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: pdfs = [], isLoading } = useQuery<NutricionRecord[]>({
    queryKey: queryKeys.nutricionByAlumno(alumno.id),
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${alumno.id}/nutricion`)
      return res.data
    },
    enabled: open,
  })

  function handleSelectFile(file: File) {
    if (file.type !== "application/pdf") {
      alert("Solo se aceptan archivos PDF")
      return
    }
    setCompressionInfo(null)
    setPendingFile(file)
  }

  async function handleUpload() {
    if (!pendingFile) return
    setUploading(true)
    setCompressionInfo(null)
    try {
      const { file: optimized, info } = await optimizePdf(pendingFile)
      if (info) setCompressionInfo(info)

      const timestamp = Date.now()
      const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const bucketPath = `${alumno.id}/${timestamp}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from("nutricion")
        .upload(bucketPath, optimized, { contentType: "application/pdf" })
      if (uploadError) throw uploadError

      await axios.post(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${alumno.id}/nutricion`,
        { nombre_archivo: pendingFile.name, pdf_path: bucketPath, habitos_link: habitosLink || null }
      )

      queryClient.invalidateQueries({ queryKey: queryKeys.nutricionByAlumno(alumno.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.nutricionCounts })
      setPendingFile(null)
      setHabitosLink("")
    } catch (err) {
      console.error(err)
      alert("Error al subir el archivo. Verificá la conexión e intentá de nuevo.")
      setCompressionInfo(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleView(record: NutricionRecord) {
    const { data, error } = await supabase.storage
      .from("nutricion")
      .createSignedUrl(record.pdf_path, 60 * 60)
    if (error || !data?.signedUrl) {
      alert("No se pudo generar el link del PDF")
      return
    }
    window.open(data.signedUrl, "_blank")
  }

  async function handleDelete(record: NutricionRecord) {
    setDeletingId(record.id)
    try {
      const res = await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/nutricion/${record.id}`)
      await supabase.storage.from("nutricion").remove([res.data.pdf_path])
      queryClient.invalidateQueries({ queryKey: queryKeys.nutricionByAlumno(alumno.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.nutricionCounts })
    } catch (err) {
      console.error(err)
      alert("Error al eliminar el PDF")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSaveHabitosAlumno() {
    setSavingHabitosAlumno(true)
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${alumno.id}/habitos-link`,
        { habitos_link: habitosAlumno || null }
      )
      setEditingHabitosAlumno(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingHabitosAlumno(false)
    }
  }

  async function handleSaveHabitos(record: NutricionRecord) {
    setSavingHabitosId(record.id)
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/nutricion/${record.id}/habitos`,
        { habitos_link: editingHabitosLink || null }
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.nutricionByAlumno(alumno.id) })
      setEditingHabitosId(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingHabitosId(null)
    }
  }

  async function handleRename(record: NutricionRecord) {
    if (!editingNombre.trim() || editingNombre === record.nombre_archivo) {
      setEditingId(null)
      return
    }
    setSavingId(record.id)
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/nutricion/${record.id}/nombre`,
        { nombre_archivo: editingNombre }
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.nutricionByAlumno(alumno.id) })
      setEditingId(null)
    } catch (err) {
      console.error(err)
      alert("Error al actualizar el nombre")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) setPendingFile(null); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl overflow-hidden w-[90vw]">
        <DialogHeader>
          <DialogTitle className="text-base">{alumno.nombre}</DialogTitle>
        </DialogHeader>

        {/* Zona de subida / preview */}
        {pendingFile ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-4 border rounded-xl bg-muted">
              <FileText className="h-8 w-8 text-[var(--primary-color)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pendingFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(pendingFile.size)}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                onClick={() => { setPendingFile(null); setCompressionInfo(null) }}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {compressionInfo && (
              <p className="text-xs text-green-600 dark:text-green-400 text-center">{compressionInfo}</p>
            )}

            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
              <Link className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                className="h-7 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                placeholder="Link de hábitos (opcional)"
                value={habitosLink}
                onChange={(e) => setHabitosLink(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setPendingFile(null); setCompressionInfo(null); setHabitosLink("") }}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-xl px-6 py-7 flex flex-col items-center gap-2 cursor-pointer select-none transition-colors ${
              dragOver
                ? "border-[var(--primary-color)] bg-[var(--primary-color)]/5"
                : "border-muted-foreground/30 hover:border-muted-foreground/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f) handleSelectFile(f)
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Subir PDF de nutrición</p>
            <p className="text-xs text-muted-foreground">Arrastrá un PDF o hacé clic</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleSelectFile(f)
            e.target.value = ""
          }}
        />

        {/* Lista de PDFs */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Historial {pdfs.length > 0 && `(${pdfs.length})`}
          </p>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pdfs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              No hay PDFs de nutrición cargados
            </p>
          ) : (
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1">
              {pdfs.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/50"
                >
                  <FileText className="h-5 w-5 text-[var(--primary-color)] shrink-0" />

                  {editingId === record.id ? (
                    <Input
                      autoFocus
                      className="h-7 text-sm flex-1"
                      value={editingNombre}
                      onChange={(e) => setEditingNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(record)
                        if (e.key === "Escape") setEditingId(null)
                      }}
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{record.nombre_archivo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(record.created_at), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  )}

                  {editingId === record.id ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700"
                      disabled={savingId === record.id}
                      onClick={() => handleRename(record)}
                    >
                      {savingId === record.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Check className="h-4 w-4" />
                      }
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => { setEditingId(record.id); setEditingNombre(record.nombre_archivo) }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleView(record)}
                    title="Ver PDF"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    disabled={deletingId === record.id}
                    onClick={() => setConfirmRecord(record)}
                  >
                    {deletingId === record.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hábitos del alumno */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Link de hábitos</p>
          {editingHabitosAlumno ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                className="h-8 text-sm flex-1"
                placeholder="https://..."
                value={habitosAlumno}
                onChange={(e) => setHabitosAlumno(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveHabitosAlumno()
                  if (e.key === "Escape") { setEditingHabitosAlumno(false); setHabitosAlumno(alumno.habitos_link ?? "") }
                }}
              />
              <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 shrink-0" disabled={savingHabitosAlumno} onClick={handleSaveHabitosAlumno}>
                {savingHabitosAlumno ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground shrink-0" onClick={() => { setEditingHabitosAlumno(false); setHabitosAlumno(alumno.habitos_link ?? "") }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : habitosAlumno ? (
            <div className="flex items-center gap-2 rounded-lg border bg-emerald-500/5 border-emerald-500/20 px-3 py-2 w-full min-w-0 overflow-hidden">
              <Link className="h-4 w-4 text-emerald-500 shrink-0" />
              <a href={habitosAlumno} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-emerald-600 truncate hover:underline w-0 min-w-0">
                {habitosAlumno}
              </a>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setEditingHabitosAlumno(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingHabitosAlumno(true)}
              className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <Link className="h-4 w-4" />
              Agregar link de hábitos
            </button>
          )}
        </div>

      </DialogContent>
    </Dialog>

    <AlertDialog open={!!confirmRecord} onOpenChange={(v) => { if (!v) setConfirmRecord(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar PDF?</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a eliminar <span className="font-medium text-foreground">"{confirmRecord?.nombre_archivo}"</span>. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              if (confirmRecord) handleDelete(confirmRecord)
              setConfirmRecord(null)
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
