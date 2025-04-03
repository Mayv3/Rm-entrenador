"use client"

import { useEffect, useState } from "react"
import {
  Calendar,
  Edit,
  FileText,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AddStudentDialog } from "@/components/add-student-dialog"
import { MessageSquare } from "lucide-react"
import { EditStudentDialog } from "@/components/edit-student-dialog"
import { DeleteStudentDialog } from "@/components/delete-student-dialog"
import { Loader } from "@/components/ui/loader"

import axios from "axios"

export function StudentsTable() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false)
  const [isDeleteStudentOpen, setIsDeleteStudentOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<(typeof students)[0] | null>(null)
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const filteredStudents = students.filter(
    (student) =>
      student?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student?.modalidad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student?.whatsapp?.includes(searchTerm),

  );

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
  
    let dateParts;
    if (dateString.includes('/')) {
      dateParts = dateString.split('/').map(Number); 
      dateString = `${dateParts[2]}-${String(dateParts[1]).padStart(2, '0')}-${String(dateParts[0]).padStart(2, '0')}`;
    }
  
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
  
    if (isNaN(date.getTime())) return 'Fecha inválida';
  
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  

  const handleEdit = (student: (typeof students)[0]) => {
    setSelectedStudent(student)
    setIsEditStudentOpen(true)
  }

  const handleDelete = (student: (typeof students)[0]) => {
    setSelectedStudent(student)
    setIsDeleteStudentOpen(true)
  }

  const fetchStudents = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getallstudents`);
      setStudents(response.data);
      console.log(`Estudiantes:`, response.data);
    } catch (error) {
      console.error("Error obteniendo los estudiantes:", error);
    } finally {
      setIsLoading(false)
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

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
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" className="fixed bottom-16 right-4 w-16 h-16 rounded-full gap-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] md:static md:h-10 md:w-[150px] md:py-2 md:rounded-md" onClick={() => setIsAddStudentOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Nuevo alumno</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader />
        </div>
      ) : (
        <>
          {/* Vista mobile */}
          <div className="grid gap-4 md:hidden">
            {filteredStudents.map((student) => (
              <Card key={student.id} className="p-3 py-4">
                <CardHeader className="pb-4">
                  <CardTitle>{student.nombre}</CardTitle>
                  <CardDescription className="text-lg">{student.modalidad}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="text-sm text-muted-foreground">{student.dias}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm text-muted-foreground">Fecha de nacimiento:{" "}</span>
                      <span>{formatDate(student.fecha_de_nacimiento)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm text-muted-foreground">Última antropometria:</span>
                      <span>{formatDate((student.ultima_antro))}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
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

          {/* Vista desktop */}
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle>Alumnos</CardTitle>
              <CardDescription>Gestiona la información de tus alumnos.</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredStudents.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre Completo</TableHead>
                        <TableHead>Modalidad</TableHead>
                        <TableHead className="hidden lg:table-cell">Días y Turnos</TableHead>
                        <TableHead className="hidden md:table-cell">Fecha de Nacimiento</TableHead>
                        <TableHead className="hidden lg:table-cell">Fecha de Inicio</TableHead>
                        <TableHead className="hidden lg:table-cell">Última antropometria</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.nombre}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <span className={`inline-block w-[10px] h-[10px] rounded-full mr-2 ${student.modalidad === 'Presencial' ? 'bg-green-500' :
                                student.modalidad === 'Online' ? 'bg-blue-500' : 'bg-purple-500'
                                }`} />
                              {student.modalidad}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">{student.dias}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatDate(student.fecha_de_nacimiento)}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {formatDate((student.fecha_de_inicio))}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {formatDate(student.ultima_antro)}
                          </TableCell>
                          <TableCell>
                            <a
                              href={`https://wa.me/${student.telefono.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <a
                              href={student.plan}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-500 hover:text-blue-700"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setIsEditStudentOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setIsDeleteStudentOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron estudiantes
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AddStudentDialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen} onStudentAdded={fetchStudents} />

      {selectedStudent && (
        <>
          <EditStudentDialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen} student={selectedStudent} onStudentUpdated={fetchStudents} />
          <DeleteStudentDialog
            open={isDeleteStudentOpen}
            onOpenChange={setIsDeleteStudentOpen}
            student={selectedStudent}
            onStudentDeleted={fetchStudents}
          />
        </>
      )}
    </>
  );


}

