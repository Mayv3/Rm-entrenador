"use client"

import React, { useMemo, useState } from "react"
import { useMediaQuery } from "@mui/material"
import { Calendar, Edit, FileText, MessageSquare, MoreHorizontal, MoreVertical, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AddStudentDialog } from "./add-student-dialog"
import { EditStudentDialog } from "./edit-student-dialog"
import { DeleteStudentDialog } from "./delete-student-dialog"
import { Loader } from "@/components/ui/loader"
import { determineSubscriptionStatus, formatDate, getStatusColor } from "@/lib/payment-utils"
import { GenericDataGrid } from "@/components/tables/DataGrid"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GridColDef } from "@mui/x-data-grid"
import axios from "axios"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePlanes, getPlanColor } from "@/hooks/use-planes"

interface Student {
  id: number
  nombre: string
  modalidad: string
  dias: string
  fecha_de_nacimiento: string
  fecha_de_inicio: string
  ultima_antro: string
  email?: string
  telefono: string
  plan: string
  status?: string
  fecha_de_vencimiento?: string
}

interface Payment {
  alumno_id: number
  fecha_de_pago: string
  fecha_de_vencimiento: string
  status: string
}

const STATUS_RANK: Record<string, number> = {
  Pagado: 1,
  Vencido: 2,
  Pendiente: 3,
  Indefinido: 4,
}


const statusLabel = (status?: string) =>
  status === "Pagado" ? "Activo" : status === "Indefinido" ? "Indefinido" : "Inactivo"

function StatusBadge({ status, fechaVencimiento, className, style }: { status?: string; fechaVencimiento?: string; className?: string; style?: React.CSSProperties }) {
  const [showDate, setShowDate] = useState(false)
  const label = statusLabel(status)
  const vencimiento = fechaVencimiento ? formatDate(fechaVencimiento) : null
  const dateText = vencimiento
    ? status === "Pagado" ? `Vence ${vencimiento}` : `Venció ${vencimiento}`
    : label
  return (
    <Badge
      style={{ backgroundColor: getStatusColor(status || "Indefinido"), cursor: vencimiento ? "pointer" : "default", ...style }}
      className={`text-white ${className ?? ""}`}
      onMouseEnter={() => vencimiento && setShowDate(true)}
      onMouseLeave={() => setShowDate(false)}
      onClick={(e) => { e.stopPropagation(); vencimiento && setShowDate((v) => !v) }}
    >
      {showDate ? dateText : label}
    </Badge>
  )
}

function StatusBadgeMobile({ status, fechaVencimiento }: { status?: string; fechaVencimiento?: string }) {
  const [open, setOpen] = useState(false)
  const label = statusLabel(status)
  const vencimiento = fechaVencimiento ? formatDate(fechaVencimiento) : null
  const tooltipText = vencimiento
    ? status === "Pagado" ? `Vence el ${vencimiento}` : `Venció el ${vencimiento}`
    : "Sin fecha de vencimiento"
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Badge
            style={{ backgroundColor: getStatusColor(status || "Indefinido"), cursor: "pointer" }}
            className="h-6 text-white"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          >
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="z-[9999]">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Subcomponente mobile ─────────────────────────────────────────────────────

function StudentMobileCard({
  student,
  onEdit,
  onDelete,
}: {
  student: Student
  onEdit: (s: Student) => void
  onDelete: (s: Student) => void
}) {
  return (
    <Card className="p-3 py-4 w-full overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{student.nombre}</CardTitle>
            <CardDescription className="text-base mt-0.5">{student.modalidad}</CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadgeMobile status={student.status} fechaVencimiento={student.fecha_de_vencimiento} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(student)} className="text-blue-600 cursor-pointer">
                  <Edit className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(student)} className="text-red-600 cursor-pointer">
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(() => {
          const diasStr = (student.dias || "").split(" - ")[0]
          const horario = (student.dias || "").split(" - ")[1] || ""
          const countMatch = diasStr.match(/^(\d+)\s*días?/)
          const count = countMatch ? parseInt(countMatch[1]) : diasStr.split(",").filter((d) => d.trim()).length
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`flex-1 h-7 rounded-md border ${
                      n <= count
                        ? "bg-[var(--primary-color)] border-[var(--primary-color)]"
                        : "bg-muted border-border"
                    }`}
                  />
                ))}
              </div>
              {horario && (
                <span className="text-xs text-muted-foreground">{count} {count === 1 ? "día" : "días"} — {horario}</span>
              )}
            </div>
          )
        })()}
        <div className="rounded-lg py-2 flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Nacimiento</span>
          <span className="text-sm font-medium">{formatDate(student.fecha_de_nacimiento || "")}</span>
        </div>
        <div className="flex gap-1">
          <a
            href={`https://wa.me/${student.telefono.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center py-2 rounded bg-[var(--primary-color)] text-white hover:bg-green-600 transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="ml-2">WhatsApp</span>
          </a>
          <a
            href={student.plan}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span className="ml-2">Plan</span>
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function StudentsTable() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false)
  const [isDeleteStudentOpen, setIsDeleteStudentOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const { data: planes = [] } = usePlanes()

  const { data: rawStudents = [], isLoading } = useQuery({
    queryKey: queryKeys.students,
    queryFn: () =>
      axios.get<Student[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getallstudents`).then((r) => r.data),
  })

  const { data: rawPayments = [] } = useQuery({
    queryKey: queryKeys.payments,
    queryFn: () =>
      axios.get<Payment[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllPayments`).then((r) => r.data),
  })

  const payments = useMemo(
    () => rawPayments.map((p) => ({ ...p, status: determineSubscriptionStatus(p) })),
    [rawPayments]
  )

  const students = useMemo(() => {
    if (!rawStudents.length) return rawStudents
    return rawStudents.map((student) => {
      const pagosAlumno = payments
        .filter((p) => Number(p.alumno_id) === Number(student.id))
        .sort((a, b) => new Date(b.fecha_de_pago).getTime() - new Date(a.fecha_de_pago).getTime())
      return {
        ...student,
        status: pagosAlumno[0]?.status ?? "Indefinido",
        fecha_de_vencimiento: pagosAlumno[0]?.fecha_de_vencimiento ?? undefined,
      }
    })
  }, [rawStudents, payments])

  const sortedStudents = useMemo(
    () =>
      students
        .filter((s) => {
          const matchesSearch =
            s.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.modalidad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.telefono?.includes(searchTerm) ||
            s.status?.toLowerCase().includes(searchTerm.toLowerCase())
          const matchesStatus =
            !statusFilter ||
            (statusFilter === "Activo" && s.status === "Pagado") ||
            (statusFilter === "Vencido" && (s.status === "Vencido" || s.status === "Pendiente")) ||
            (statusFilter === "Indefinido" && s.status === "Indefinido")
          return matchesSearch && matchesStatus
        })
        .sort((a, b) => {
          const ra = STATUS_RANK[a.status || "Indefinido"] ?? 99
          const rb = STATUS_RANK[b.status || "Indefinido"] ?? 99
          return ra - rb
        }),
    [students, searchTerm, statusFilter]
  )

  const isLg = useMediaQuery("(min-width:1024px)")
  const isXl = useMediaQuery("(min-width:1280px)")

  const handleEdit = (student: Student) => { setSelectedStudent(student); setIsEditStudentOpen(true) }
  const handleDelete = (student: Student) => { setSelectedStudent(student); setIsDeleteStudentOpen(true) }

  // Ocultar columnas menos importantes en pantallas más chicas
  const columnVisibilityModel = useMemo(() => ({
    fecha_de_nacimiento: isLg,
    fecha_de_inicio: isLg,
  }), [isLg, isXl])

  const studentsColumns: GridColDef[] = [
    { field: "nombre", headerName: "Nombre Completo", flex: 1.5, minWidth: 130 },
    {
      field: "modalidad", headerName: "Tipo de plan", flex: 0.9, minWidth: 110,
      renderCell: ({ value }) => (
        <span className="flex items-center">
          <span className="inline-block w-[10px] h-[10px] rounded-full mr-2" style={{ backgroundColor: getPlanColor(planes, value) }} />
          {value}
        </span>
      ),
    },
    {
      field: "dias", headerName: "Días y Turnos", flex: 1.2, minWidth: 160,
      renderCell: ({ value }) => {
        const diasStr = (value || "").split(" - ")[0]
        const horario = (value || "").split(" - ")[1] || ""
        const countMatch = diasStr.match(/^(\d+)\s*días?/)
        const count = countMatch ? parseInt(countMatch[1]) : diasStr.split(",").filter((d: string) => d.trim()).length
        return (
          <span className="flex items-center gap-1.5 w-full">
            <span className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`inline-block w-4 h-4 rounded-sm border ${
                    n <= count
                      ? "bg-[var(--primary-color)] border-[var(--primary-color)]"
                      : "bg-muted border-border"
                  }`}
                />
              ))}
            </span>
            {horario && <span className="text-xs text-muted-foreground">{horario}</span>}
          </span>
        )
      },
    },
    {
      field: "fecha_de_nacimiento", headerName: "Nacimiento", flex: 0.9, minWidth: 120,
      renderCell: ({ value }) => (
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(value || "")}
        </span>
      ),
    },
    {
      field: "fecha_de_inicio", headerName: "Inicio", flex: 0.8, minWidth: 110,
      renderCell: ({ value }) => formatDate(value || ""),
    },
    {
      field: "status", headerName: "Estado", flex: 0.8, minWidth: 100,
      renderCell: ({ value, row }) => (
        <span style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          <StatusBadge status={value} fechaVencimiento={row.fecha_de_vencimiento} style={{ width: "90%", justifyContent: "center", padding: "6px 0" }} />
        </span>
      ),
    },
    {
      field: "telefono", headerName: "WA", width: 70, sortable: false,
      renderCell: ({ value }) => (
        <span className="flex items-center justify-center w-full h-full">
          <a href={`https://wa.me/${value?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-[85%] h-[75%] rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors">
            <MessageSquare className="h-4 w-4" />
          </a>
        </span>
      ),
    },
    {
      field: "plan", headerName: "Plan", width: 70, sortable: false,
      renderCell: ({ value }) => (
        <span className="flex items-center justify-center w-full h-full">
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-[85%] h-[75%] rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors">
            <FileText className="h-4 w-4" />
          </a>
        </span>
      ),
    },
    {
      field: "acciones", headerName: "", width: 50, sortable: false,
      renderCell: ({ row }) => (
        <span className="flex items-center justify-center w-full h-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(row as Student)} className="text-blue-600 cursor-pointer">
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(row as Student)} className="text-red-600 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ),
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 w-full md:w-96">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar alumnos..."
              className="w-full pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 md:hidden">
            {[null, "Activo", "Vencido", "Indefinido"].map((f) => (
              <button
                key={f ?? "todos"}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  statusFilter === f
                    ? "bg-[var(--primary-color)] text-white border-[var(--primary-color)]"
                    : "bg-background text-muted-foreground border-border"
                }`}
              >
                {f ?? "Todos"}
              </button>
            ))}
          </div>
        </div>
        <Button
          size="sm"
          className="fixed bottom-24 right-4 w-16 h-16 rounded-full gap-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] active:scale-90 md:active:scale-95 transition-transform duration-100 md:static md:h-10 md:w-[150px] md:py-2 md:rounded-md"
          onClick={() => setIsAddStudentOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Nuevo alumno</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {sortedStudents.map((student) => (
              <StudentMobileCard key={student.id} student={student} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
          <div className="hidden md:block">
            <GenericDataGrid rows={sortedStudents} columns={studentsColumns} initialSortModel={[]} columnVisibilityModel={columnVisibilityModel} />
          </div>
        </>
      )}

      <AddStudentDialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen} onStudentAdded={() => {}} />
      {selectedStudent && (
        <>
          <EditStudentDialog
            open={isEditStudentOpen}
            onOpenChange={setIsEditStudentOpen}
            student={selectedStudent}
            onStudentUpdated={() => {}}
          />
          <DeleteStudentDialog
            open={isDeleteStudentOpen}
            onOpenChange={setIsDeleteStudentOpen}
            student={{ id: selectedStudent.id.toString(), name: selectedStudent.nombre }}
            onStudentDeleted={() => {}}
          />
        </>
      )}
    </>
  )
}
