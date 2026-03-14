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
import { Upload, FileText, Trash2, Eye, Loader2, X, Pencil, Check, BarChart2, ArrowLeft } from "lucide-react"
import { AntroView, ParsedAntro } from "./antro-view"

interface Student {
  id: number
  nombre: string
}

interface AntroRecord {
  id: number
  alumno_id: number
  nombre_archivo: string
  pdf_path: string
  created_at: string
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

export function AntroUploadDialog({ open, onOpenChange, alumno }: Props) {
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmAntro, setConfirmAntro] = useState<AntroRecord | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingNombre, setEditingNombre] = useState("")
  const [savingId, setSavingId] = useState<number | null>(null)
  const [parsedData, setParsedData] = useState<ParsedAntro | null>(null)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: antros = [], isLoading } = useQuery<AntroRecord[]>({
    queryKey: queryKeys.antrosByAlumno(alumno.id),
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${alumno.id}/antropometrias`)
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
        .from("antropometrias")
        .upload(bucketPath, optimized, { contentType: "application/pdf" })
      if (uploadError) throw uploadError

      await axios.post(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${alumno.id}/antropometrias`,
        { nombre_archivo: pendingFile.name, pdf_path: bucketPath }
      )

      queryClient.invalidateQueries({ queryKey: queryKeys.antrosByAlumno(alumno.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.antrosCounts })
      queryClient.invalidateQueries({ queryKey: queryKeys.students })
      setPendingFile(null)
    } catch (err) {
      console.error(err)
      alert("Error al subir el archivo. Verificá la conexión e intentá de nuevo.")
      setCompressionInfo(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleAnalysis(antro: AntroRecord) {
    setParsing(true)
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/antropometrias/${antro.id}/parsed`)
      setParsedData(res.data)
    } catch (err) {
      console.error(err)
      alert("Error al procesar la antropometría")
    } finally {
      setParsing(false)
    }
  }

  async function handleView(antro: AntroRecord) {
    const { data, error } = await supabase.storage
      .from("antropometrias")
      .createSignedUrl(antro.pdf_path, 60 * 60)
    if (error || !data?.signedUrl) {
      alert("No se pudo generar el link del PDF")
      return
    }
    window.open(data.signedUrl, "_blank")
  }

  async function handleDelete(antro: AntroRecord) {
    setDeletingId(antro.id)
    try {
      const res = await axios.delete(`${process.env.NEXT_PUBLIC_URL_BACKEND}/antropometrias/${antro.id}`)
      await supabase.storage.from("antropometrias").remove([res.data.pdf_path])
      queryClient.invalidateQueries({ queryKey: queryKeys.antrosByAlumno(alumno.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.antrosCounts })
    } catch (err) {
      console.error(err)
      alert("Error al eliminar el PDF")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRename(antro: AntroRecord) {
    if (!editingNombre.trim() || editingNombre === antro.nombre_archivo) {
      setEditingId(null)
      return
    }
    setSavingId(antro.id)
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/antropometrias/${antro.id}/nombre`,
        { nombre_archivo: editingNombre }
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.antrosByAlumno(alumno.id) })
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPendingFile(null); setParsedData(null) }; onOpenChange(v) }}>
      <DialogContent className={parsedData ? "max-w-2xl max-h-[90vh] overflow-y-auto" : "max-w-2xl"}>
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {parsedData && (
              <button
                onClick={() => setParsedData(null)}
                className="flex items-center gap-1 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
            )}
            {!parsedData && alumno.nombre}
          </DialogTitle>
        </DialogHeader>

        {/* Vista de análisis */}
        {parsedData ? (
          <AntroView data={parsedData} />
        ) : parsing ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            <p className="text-sm text-muted-foreground">Procesando antropometría...</p>
          </div>
        ) : (
          <>
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setPendingFile(null); setCompressionInfo(null) }}
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
            <p className="text-sm font-medium">Subir nueva antropometría</p>
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
            Historial {antros.length > 0 && `(${antros.length})`}
          </p>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : antros.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              No hay antropometrías cargadas
            </p>
          ) : (
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1">
              {antros.map((antro) => (
                <div
                  key={antro.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/50 cursor-pointer hover:border-green-400 hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors"
                  onClick={() => handleAnalysis(antro)}
                >
                  <FileText className="h-5 w-5 text-[var(--primary-color)] shrink-0" />

                  {editingId === antro.id ? (
                    <Input
                      autoFocus
                      className="h-7 text-sm flex-1"
                      value={editingNombre}
                      onChange={(e) => setEditingNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(antro)
                        if (e.key === "Escape") setEditingId(null)
                      }}
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{antro.nombre_archivo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(antro.created_at), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  )}

                  {editingId === antro.id ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700"
                      disabled={savingId === antro.id}
                      onClick={(e) => { e.stopPropagation(); handleRename(antro) }}
                    >
                      {savingId === antro.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Check className="h-4 w-4" />
                      }
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); setEditingId(antro.id); setEditingNombre(antro.nombre_archivo) }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); handleView(antro) }}
                    title="Ver PDF"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    disabled={deletingId === antro.id}
                    onClick={(e) => { e.stopPropagation(); setConfirmAntro(antro) }}
                  >
                    {deletingId === antro.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!confirmAntro} onOpenChange={(v) => { if (!v) setConfirmAntro(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar antropometría?</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a eliminar <span className="font-medium text-foreground">"{confirmAntro?.nombre_archivo}"</span>. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              if (confirmAntro) handleDelete(confirmAntro)
              setConfirmAntro(null)
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
