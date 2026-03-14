"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { queryKeys } from "@/lib/query-keys"
import { Input } from "@/components/ui/input"
import { FileText, Search, User, Calendar } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AntroUploadDialog } from "./antro-upload-dialog"
import { Loader } from "@/components/ui/loader"

interface Student {
  id: number
  nombre: string
  modalidad?: string
  ultima_antro?: string | null
}

function AlumnoCard({ alumno, count, onClick }: { alumno: Student; count: number; onClick: () => void }) {
  const hasPdf = count > 0
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-3 transition-all hover:border-[var(--primary-color)] hover:shadow-sm active:scale-[0.97]"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
        hasPdf ? "bg-[var(--primary-color)]/10 text-[var(--primary-color)]" : "bg-muted text-muted-foreground"
      }`}>
        <User className="h-5 w-5" />
      </div>
      <p className="w-full text-center text-xs font-medium leading-tight line-clamp-2">{alumno.nombre}</p>
      <div className="flex flex-col gap-0.5 w-full items-center">
        {hasPdf && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--primary-color)]">
            <FileText className="h-3 w-3" />
            {count} {count === 1 ? "PDF" : "PDFs"}
          </div>
        )}
        {alumno.ultima_antro && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(alumno.ultima_antro), "d MMM yy", { locale: es })}
          </div>
        )}
      </div>
    </button>
  )
}

export function AntropometriasSection() {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Student | null>(null)

  const { data: students = [], isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: queryKeys.students,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllStudents`)
      return res.data
    },
  })

  const { data: counts = {} } = useQuery<Record<number, number>>({
    queryKey: queryKeys.antrosCounts,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/antropometrias/counts`)
      return res.data
    },
  })

  const filtered = students.filter((s) => s.nombre?.toLowerCase().includes(search.toLowerCase()))

  const conAntro = filtered
    .filter((s) => s.ultima_antro)
    .sort((a, b) => new Date(b.ultima_antro!).getTime() - new Date(a.ultima_antro!).getTime())

  const sinAntro = filtered.filter((s) => !s.ultima_antro)

  if (loadingStudents) return <Loader />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold shrink-0">Antropometría</h2>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar alumno..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No se encontraron alumnos</p>
      ) : (
        <div className="space-y-5">
          {conAntro.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Con antropometría ({conAntro.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {conAntro.map((alumno) => (
                  <AlumnoCard key={alumno.id} alumno={alumno} count={counts[alumno.id] ?? 0} onClick={() => setSelected(alumno)} />
                ))}
              </div>
            </div>
          )}

          {sinAntro.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Sin antropometría ({sinAntro.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {sinAntro.map((alumno) => (
                  <AlumnoCard key={alumno.id} alumno={alumno} count={counts[alumno.id] ?? 0} onClick={() => setSelected(alumno)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <AntroUploadDialog
          open={!!selected}
          onOpenChange={(v) => { if (!v) setSelected(null) }}
          alumno={selected}
        />
      )}
    </div>
  )
}
