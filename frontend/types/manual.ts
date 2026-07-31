export type ManualPaso = {
  id?: number
  capitulo_id?: number
  orden?: number
  titulo: string
  texto: string
}

export type ManualCapitulo = {
  id?: number
  orden?: number
  eyebrow: string | null
  titulo: string
  resumen: string | null
  /** URL pública de la captura. Puede ser del bucket o un asset estático (/manual/...). */
  imagen_url: string | null
  /** Ruta dentro del bucket "manual". null cuando la imagen es un asset estático. */
  imagen_path: string | null
  pasos: ManualPaso[]
}
