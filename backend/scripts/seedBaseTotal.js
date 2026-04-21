/**
 * Script para importar todos los ejercicios de BaseTotal.html a Supabase.
 * Uso: node backend/scripts/seedBaseTotal.js
 *
 * Parsea: NOMBRE, LINK (video_url), CATEGORÍA (grupo_muscular).
 * Usa upsert por nombre para no duplicar ejercicios ya existentes.
 */

import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, "../.env") })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
)

function parseExercises() {
  const html = readFileSync(resolve(__dirname, "../../BaseTotal.html"), "utf-8")
  const exercises = []

  // Extraer cada fila de la tabla
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  let rowMatch

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]

    // Saltar header y freezebar (las filas de datos también tienen row-headers-background pero sí tienen tds)
    if (row.includes("NOMBRE") || row.includes("freezebar-cell")) continue

    // Extraer las 4 celdas td
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
    const tds = []
    let tdMatch
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      tds.push(tdMatch[1])
    }

    if (tds.length < 3) continue

    // Col A → nombre (quitar tags HTML)
    const nombre = tds[0].replace(/<[^>]+>/g, "").trim()
    if (!nombre) continue

    // Col B → video_url (extraer href del <a>)
    const hrefMatch = tds[1].match(/href="([^"]+)"/)
    const video_url = hrefMatch ? hrefMatch[1].trim() : null

    // Col C → grupo_muscular
    const grupo_muscular = tds[2].replace(/<[^>]+>/g, "").trim() || null

    exercises.push({ nombre, video_url, grupo_muscular, es_base: true })
  }

  return exercises
}

async function run() {
  const exercises = parseExercises()
  console.log(`Ejercicios encontrados en el HTML: ${exercises.length}`)

  if (exercises.length === 0) {
    console.log("No se encontraron ejercicios. Verificá la ruta del archivo HTML.")
    return
  }

  // Traer nombres existentes para no duplicar
  const { data: existentes, error: fetchError } = await supabase
    .from("ejercicios")
    .select("nombre")

  if (fetchError) {
    console.error("Error al obtener ejercicios existentes:", fetchError.message)
    return
  }

  const nombresExistentes = new Set(existentes.map((e) => e.nombre.toLowerCase().trim()))
  const nuevos = exercises.filter((e) => !nombresExistentes.has(e.nombre.toLowerCase().trim()))

  console.log(`Ya existen: ${nombresExistentes.size} | Nuevos a insertar: ${nuevos.length}`)

  if (nuevos.length === 0) {
    console.log("No hay ejercicios nuevos para insertar.")
    return
  }

  // Insertar en lotes de 50
  const BATCH = 50
  let inserted = 0
  let errors = 0

  for (let i = 0; i < nuevos.length; i += BATCH) {
    const batch = nuevos.slice(i, i + BATCH)
    const { error } = await supabase.from("ejercicios").insert(batch)

    if (error) {
      console.error(`  ✗ Lote ${i / BATCH + 1}: ${error.message}`)
      errors += batch.length
    } else {
      inserted += batch.length
      console.log(`  ✓ Lote ${i / BATCH + 1}: ${batch.length} ejercicios insertados`)
    }
  }

  console.log(`\nListo. ${inserted} insertados, ${errors} con error.`)
}

run()
