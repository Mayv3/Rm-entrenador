"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown, FileSpreadsheet, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface PlanCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Sample data - in a real app this would come from a database
const students = [
  { id: "1", name: "Carlos Rodríguez" },
  { id: "2", name: "María González" },
  { id: "3", name: "Juan Pérez" },
  { id: "4", name: "Laura Martínez" },
  { id: "5", name: "Fernando López" },
]

// Lista de ejercicios de ejemplo
const exercises = [
  { id: "1", name: "Sentadilla" },
  { id: "2", name: "Hip Thrust" },
  { id: "3", name: "Estocadas" },
  { id: "4", name: "Press de Banca" },
  { id: "5", name: "Peso Muerto" },
  { id: "6", name: "Dominadas" },
  { id: "7", name: "Fondos" },
  { id: "8", name: "Curl de Bíceps" },
  { id: "9", name: "Extensiones de Tríceps" },
  { id: "10", name: "Press Militar" },
  { id: "11", name: "Remo con Barra" },
  { id: "12", name: "Elevaciones Laterales" },
  { id: "13", name: "Zancadas" },
  { id: "14", name: "Prensa de Piernas" },
  { id: "15", name: "Extensiones de Cuádriceps" },
  { id: "16", name: "Curl de Isquiotibiales" },
  { id: "17", name: "Elevaciones de Pantorrillas" },
  { id: "18", name: "Abdominales" },
  { id: "19", name: "Plancha" },
  { id: "20", name: "Russian Twist" },
]

interface ExerciseItem {
  id: string
  exerciseId: string
  sets: number
  reps: string
  rest: string
  notes: string
}

interface DayPlan {
  exercises: ExerciseItem[]
}

export function PlanCreator({ open, onOpenChange }: PlanCreatorProps) {
  const [formData, setFormData] = useState({
    studentId: "",
    planName: "",
  })

  const [days, setDays] = useState<{
    day1: DayPlan
    day2: DayPlan
    day3: DayPlan
  }>({
    day1: { exercises: [] },
    day2: { exercises: [] },
    day3: { exercises: [] },
  })

  const [activeDay, setActiveDay] = useState<"day1" | "day2" | "day3">("day1")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const addExercise = (day: "day1" | "day2" | "day3") => {
    if (days[day].exercises.length >= 7) return // Máximo 7 ejercicios por día

    const newExercise: ExerciseItem = {
      id: Math.random().toString(36).substring(2, 9),
      exerciseId: "",
      sets: 3,
      reps: "8-12",
      rest: "60s",
      notes: "",
    }

    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        exercises: [...prev[day].exercises, newExercise],
      },
    }))
  }

  const removeExercise = (day: "day1" | "day2" | "day3", id: string) => {
    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        exercises: prev[day].exercises.filter((ex) => ex.id !== id),
      },
    }))
  }

  const updateExercise = (day: "day1" | "day2" | "day3", id: string, field: keyof ExerciseItem, value: any) => {
    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        exercises: prev[day].exercises.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)),
      },
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Aquí se generaría el Google Sheet real con la API de Google
    console.log("Plan creado:", { ...formData, days })

    // Simular la creación exitosa
    alert("Plan creado exitosamente. En una aplicación real, esto generaría un Google Sheet.")
    onOpenChange(false)
  }

  const getExerciseName = (id: string) => {
    const exercise = exercises.find((ex) => ex.id === id)
    return exercise ? exercise.name : "Seleccionar ejercicio"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Plan de Entrenamiento</DialogTitle>
          <DialogDescription>Diseña un plan de entrenamiento personalizado dividido en 3 días.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="studentId">Alumno</Label>
              <Select value={formData.studentId} onValueChange={(value) => handleSelectChange("studentId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar alumno" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="planName">Nombre del Plan</Label>
              <Input
                id="planName"
                name="planName"
                value={formData.planName}
                onChange={handleChange}
                placeholder="Ej: Plan de Fuerza - Nivel Intermedio"
                required
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col" style={{ maxHeight: "60vh" }}>
            <Tabs
              defaultValue="day1"
              value={activeDay}
              onValueChange={(value) => setActiveDay(value as "day1" | "day2" | "day3")}
              className="flex flex-col h-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="day1">Día 1</TabsTrigger>
                <TabsTrigger value="day2">Día 2</TabsTrigger>
                <TabsTrigger value="day3">Día 3</TabsTrigger>
              </TabsList>

              {(["day1", "day2", "day3"] as const).map((day) => (
                <TabsContent key={day} value={day} className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">
                      {day === "day1" ? "Día 1" : day === "day2" ? "Día 2" : "Día 3"}
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addExercise(day)}
                      disabled={days[day].exercises.length >= 7}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Añadir Ejercicio
                    </Button>
                  </div>

                  <ScrollArea className="h-[calc(60vh-150px)]">
                    <div className="space-y-4 pr-4">
                      {days[day].exercises.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No hay ejercicios añadidos. Haz clic en "Añadir Ejercicio" para comenzar.
                        </div>
                      ) : (
                        days[day].exercises.map((exercise, index) => (
                          <Card key={exercise.id} className="relative">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeExercise(day, exercise.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base font-medium flex items-center">
                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 inline-flex items-center justify-center text-xs mr-2">
                                  {index + 1}
                                </span>
                                Ejercicio {index + 1}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid gap-2">
                                <Label>Seleccionar Ejercicio</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="justify-between w-full">
                                      {exercise.exerciseId
                                        ? getExerciseName(exercise.exerciseId)
                                        : "Seleccionar ejercicio"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-full p-0">
                                    <Command>
                                      <CommandInput placeholder="Buscar ejercicio..." />
                                      <CommandList>
                                        <CommandEmpty>No se encontraron ejercicios.</CommandEmpty>
                                        <CommandGroup>
                                          {exercises.map((ex) => (
                                            <CommandItem
                                              key={ex.id}
                                              value={ex.name}
                                              onSelect={() => {
                                                updateExercise(day, exercise.id, "exerciseId", ex.id)
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  exercise.exerciseId === ex.id ? "opacity-100" : "opacity-0",
                                                )}
                                              />
                                              {ex.name}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                  <Label>Series</Label>
                                  <Select
                                    value={exercise.sets.toString()}
                                    onValueChange={(value) =>
                                      updateExercise(day, exercise.id, "sets", Number.parseInt(value))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Series" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[1, 2, 3, 4, 5, 6].map((num) => (
                                        <SelectItem key={num} value={num.toString()}>
                                          {num}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Repeticiones</Label>
                                  <Select
                                    value={exercise.reps}
                                    onValueChange={(value) => updateExercise(day, exercise.id, "reps", value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Reps" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="6-8">6-8</SelectItem>
                                      <SelectItem value="8-10">8-10</SelectItem>
                                      <SelectItem value="8-12">8-12</SelectItem>
                                      <SelectItem value="10-15">10-15</SelectItem>
                                      <SelectItem value="12-15">12-15</SelectItem>
                                      <SelectItem value="15-20">15-20</SelectItem>
                                      <SelectItem value="AMRAP">AMRAP</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Descanso</Label>
                                  <Select
                                    value={exercise.rest}
                                    onValueChange={(value) => updateExercise(day, exercise.id, "rest", value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Descanso" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="30s">30s</SelectItem>
                                      <SelectItem value="45s">45s</SelectItem>
                                      <SelectItem value="60s">60s</SelectItem>
                                      <SelectItem value="90s">90s</SelectItem>
                                      <SelectItem value="2min">2min</SelectItem>
                                      <SelectItem value="3min">3min</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid gap-2">
                                <Label>Notas</Label>
                                <Input
                                  value={exercise.notes}
                                  onChange={(e) => updateExercise(day, exercise.id, "notes", e.target.value)}
                                  placeholder="Instrucciones especiales o notas"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <DialogFooter className="mt-4">
            <div className="flex items-center mr-auto">
              <FileSpreadsheet className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm text-muted-foreground">Se creará un Google Sheet con esta estructura</span>
            </div>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear Plan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

