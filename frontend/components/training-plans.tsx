"use client"

import { useState } from "react"
import { ChevronDown, ExternalLink, FileSpreadsheet, Plus, Search, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { PlanCreator } from "@/components/plan-creator"

// Sample data - in a real app this would come from a database
const plans = [
  {
    id: "1",
    studentName: "Carlos Rodríguez",
    planName: "Plan de Fuerza - Nivel Intermedio",
    dateCreated: "2023-06-15",
    lastUpdated: "2023-07-05",
    url: "https://docs.google.com/spreadsheets/d/example1",
  },
  {
    id: "2",
    studentName: "María González",
    planName: "Plan de Cardio - Principiante",
    dateCreated: "2023-07-01",
    lastUpdated: "2023-07-10",
    url: "https://docs.google.com/spreadsheets/d/example2",
  },
  {
    id: "3",
    studentName: "Juan Pérez",
    planName: "Plan de Hipertrofia - Avanzado",
    dateCreated: "2023-05-20",
    lastUpdated: "2023-06-28",
    url: "https://docs.google.com/spreadsheets/d/example3",
  },
  {
    id: "4",
    studentName: "Laura Martínez",
    planName: "Plan de Rehabilitación - Rodilla",
    dateCreated: "2023-06-10",
    lastUpdated: "2023-07-08",
    url: "https://docs.google.com/spreadsheets/d/example4",
  },
  {
    id: "5",
    studentName: "Fernando López",
    planName: "Plan de Nutrición y Entrenamiento",
    dateCreated: "2023-07-02",
    lastUpdated: "2023-07-12",
    url: "https://docs.google.com/spreadsheets/d/example5",
  },
]

export function TrainingPlans() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreatorOpen, setIsCreatorOpen] = useState(false)

  const filteredPlans = plans.filter(
    (plan) =>
      plan.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.planName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar planes..."
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
                <span className="hidden xs:inline">Opciones</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Duplicar plan existente</DropdownMenuItem>
              <DropdownMenuItem>Ver plantillas</DropdownMenuItem>
              <DropdownMenuItem>Exportar todos los planes</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-8 gap-1" onClick={() => setIsCreatorOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Crear Plan</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planes Personalizados</CardTitle>
          <CardDescription>
            Gestiona los planes de entrenamiento personalizados para tus alumnos en Google Sheets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Nombre del Plan</TableHead>
                <TableHead className="hidden md:table-cell">Fecha Creación</TableHead>
                <TableHead className="hidden md:table-cell">Última Actualización</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.studentName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      {plan.planName}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(plan.dateCreated).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(plan.lastUpdated).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
                        <a href={plan.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Abrir</span>
                        </a>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Duplicar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PlanCreator open={isCreatorOpen} onOpenChange={setIsCreatorOpen} />
    </>
  )
}

