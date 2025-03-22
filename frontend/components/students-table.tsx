"use client"

import { useState } from "react"
import {
  Calendar,
  Check,
  ChevronDown,
  Download,
  Edit,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddStudentDialog } from "@/components/add-student-dialog"
import { MessageSquare } from "lucide-react"
import { EditStudentDialog } from "@/components/edit-student-dialog"
import { DeleteStudentDialog } from "@/components/delete-student-dialog"

const students = [
  {
    id: "1",
    name: "Nicolas Pereyra",
    modality: "Presencial",
    birthDate: "2003-12-01",
    whatsapp: "+543513274314",
    schedule: "Lun, Mie, Vie - 9:00",
    lastTraining: "2023-07-10",
    attendance: "85",
    planUrl: "https://docs.google.com/spreadsheets/d/example1",
  },
]

export function StudentsTable() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false)
  const [isDeleteStudentOpen, setIsDeleteStudentOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<(typeof students)[0] | null>(null)

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.modality.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.whatsapp.includes(searchTerm),
  )

  const handleEdit = (student: (typeof students)[0]) => {
    setSelectedStudent(student)
    setIsEditStudentOpen(true)
  }

  const handleDelete = (student: (typeof students)[0]) => {
    setSelectedStudent(student)
    setIsDeleteStudentOpen(true)
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar alumnos..."
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Filtros</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem>Presencial</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Online</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Híbrido</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddStudentOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Nuevo Alumno</span>
          </Button>
        </div>
      </div>

      {/* Vista en mobile con cards */}
      <div className="grid gap-4 md:hidden">
        {filteredStudents.map((student) => (
          <Card key={student.id} className="p-4">
            <CardHeader>
              <CardTitle>{student.name}</CardTitle>
              <CardDescription>{student.modality}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {new Date(student.birthDate).toLocaleDateString()}
              </div>

              <div className="text-sm text-muted-foreground">{student.schedule}</div>
              <div className="flex items-center gap-2">
                Último entreno: {new Date(student.lastTraining).toLocaleDateString()}
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/${student.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center py-2 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="ml-2">WhatsApp</span>
                </a>
                <a
                  href={student.planUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span className="ml-2">Plan</span>
                </a>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleEdit(student)} variant="outline" className="flex-1 w-full">
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
                <Button size="sm" onClick={() => handleDelete(student)} variant="destructive" className="flex-1 w-full">
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vista en desktop con tabla */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Alumnos</CardTitle>
          <CardDescription>Gestiona la información de tus alumnos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Completo</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha de Nacimiento</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="hidden lg:table-cell">Días y Turnos</TableHead>
                  <TableHead className="hidden lg:table-cell">Último Entreno</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.modality}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(student.birthDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://wa.me/${student.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <a
                        href={student.planUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                      </a>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{student.schedule}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {new Date(student.lastTraining).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700" onClick={() => handleEdit(student)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(student)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddStudentDialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen} />

      {selectedStudent && (
        <>
          <EditStudentDialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen} student={selectedStudent} />
          <DeleteStudentDialog
            open={isDeleteStudentOpen}
            onOpenChange={setIsDeleteStudentOpen}
            student={selectedStudent}
          />
        </>
      )}
    </>
  )
}

