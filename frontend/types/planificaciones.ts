import type React from "react"

export interface Ejercicio {
  id: number
  nombre: string
  grupo_muscular: string | null
  video_url: string | null
  es_base: boolean
}

export interface TipoEjercicio {
  id: number
  nombre: string
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
  notas_profesor: string | null
}

export interface PlanEjercicio {
  id: number
  planificacion_dia_id: number
  ejercicio_id: number
  categoria: string
  orden: number
  series: number
  es_aerobico: boolean
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
  necesita_nueva?: boolean
  casi_completo?: boolean
}

export const CATEGORIAS = ["ACTIVADOR"] as const
export type Categoria = (typeof CATEGORIAS)[number]

export const CATEGORIA_COLORS: Record<string, string> = {
  ACTIVADOR: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
}

// Usa variables CSS definidas en globals.css (soportan dark mode automáticamente)
export const CATEGORIA_ROW_STYLE: Record<string, React.CSSProperties> = {
  ACTIVADOR: { backgroundColor: "var(--cat-activador-bg)", color: "var(--cat-activador-color)" },
}
