import type React from "react"

export interface Ejercicio {
  id: number
  nombre: string
  grupo_muscular: string | null
  video_url: string | null
  es_base: boolean
}

export interface MovilidadItem {
  id: number
  hoja_id: number
  nombre: string
  imagen_url: string | null
  orden: number
}

export interface PlanSemana {
  id: number
  planificacion_ejercicio_id: number
  semana: number
  dosis: string | null
  rpe: number | null
}

export interface PlanEjercicio {
  id: number
  planificacion_dia_id: number
  ejercicio_id: number
  categoria: string
  orden: number
  notas_profesor: string | null
  ejercicios: Ejercicio
  semanas: PlanSemana[]
}

export interface PlanDia {
  id: number
  hoja_id: number
  numero_dia: number
  nombre: string
  orden: number
  ejercicios: PlanEjercicio[]
}

export interface PlanHoja {
  id: number
  planificacion_id: number
  nombre: string
  numero: number
  estado: "activa" | "completada"
  created_at: string
  dias: PlanDia[]
  movilidad: MovilidadItem[]
}

export interface Planificacion {
  id: number
  nombre: string
  alumno_id: number | null
  hoja_activa_id: number | null
  semanas: number
  estado: string
  created_at: string
  alumnos?: { id: number; nombre: string } | null
  hojas: PlanHoja[]
}

export interface PlanificacionListItem {
  id: number
  nombre: string
  alumno_id: number | null
  hoja_activa_id: number | null
  estado: string
  created_at: string
  alumnos?: { id: number; nombre: string } | null
  planificacion_hojas?: { id: number; nombre: string; numero: number; estado: string }[]
}

export const CATEGORIAS = ["ACTIVADOR", "A", "B", "C", "D", "E"] as const
export type Categoria = (typeof CATEGORIAS)[number]

export const CATEGORIA_COLORS: Record<string, string> = {
  ACTIVADOR: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  A: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  B: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  C: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  D: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  E: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
}

// Usa variables CSS definidas en globals.css (soportan dark mode automáticamente)
export const CATEGORIA_ROW_STYLE: Record<string, React.CSSProperties> = {
  ACTIVADOR: { backgroundColor: "var(--cat-activador-bg)", color: "var(--cat-activador-color)" },
  A:         { backgroundColor: "var(--cat-a-bg)",         color: "var(--cat-a-color)" },
  B:         { backgroundColor: "var(--cat-b-bg)",         color: "var(--cat-b-color)" },
  C:         { backgroundColor: "var(--cat-c-bg)",         color: "var(--cat-c-color)" },
  D:         { backgroundColor: "var(--cat-d-bg)",         color: "var(--cat-d-color)" },
  E:         { backgroundColor: "var(--cat-e-bg)",         color: "var(--cat-e-color)" },
}
