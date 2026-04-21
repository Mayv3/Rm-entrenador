/**
 * Script para importar ejercicios de movilidad desde BaseMov.html.
 * Uso: node backend/scripts/seedBaseMov.js
 *
 * Columnas del HTML: NOMBRE | LINK (YouTube) | LINK IMAGEN (Drive) | LINK IMAGEN DRIVE
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
  const html = readFileSync(resolve(__dirname, "../../BaseMov.html"), "utf-8")
  const exercises = []

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  let rowMatch

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]

    if (row.includes("NOMBRE") || row.includes("freezebar-cell")) continue

    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
    const tds = []
    let tdMatch
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      tds.push(tdMatch[1])
    }

    if (tds.length < 1) continue

    // Col 0 → nombre
    const nombre = tds[0].replace(/<[^>]+>/g, "").trim()
    if (!nombre) continue

    // Col 1 → video_url (YouTube)
    let video_url = null
    if (tds[1]) {
      const ytMatch = tds[1].match(/href="(https?:\/\/(?:www\.)?youtube[^"]+)"/)
      if (ytMatch) video_url = ytMatch[1]
    }

    // Col 2 → imagen_url (Google Drive uc?export=view)
    let imagen_url = null
    if (tds[2]) {
      const imgMatch = tds[2].match(/href="(https?:\/\/drive\.google\.com\/uc\?export=view[^"]*)"/)
      if (imgMatch) imagen_url = imgMatch[1].replace(/&amp;/g, "&")
    }

    exercises.push({ nombre, video_url, imagen_url })
  }

  return exercises
}

async function run() {
  const exercises = parseExercises()
  console.log(`Ejercicios de movilidad encontrados: ${exercises.length}`)

  if (exercises.length === 0) {
    console.log("No se encontraron ejercicios.")
    return
  }

  // Traer existentes para no duplicar
  const { data: existentes, error: fetchError } = await supabase
    .from("ejercicios_movilidad")
    .select("nombre")

  if (fetchError) {
    console.error("Error al obtener existentes:", fetchError.message)
    return
  }

  const nombresExistentes = new Set(existentes.map((e) => e.nombre.toLowerCase().trim()))
  const nuevos = exercises.filter((e) => !nombresExistentes.has(e.nombre.toLowerCase().trim()))

  console.log(`Ya existen: ${nombresExistentes.size} | Nuevos a insertar: ${nuevos.length}`)

  if (nuevos.length === 0) {
    console.log("No hay ejercicios nuevos.")
    return
  }

  const BATCH = 50
  let inserted = 0
  let errors = 0

  for (let i = 0; i < nuevos.length; i += BATCH) {
    const batch = nuevos.slice(i, i + BATCH)
    const { error } = await supabase.from("ejercicios_movilidad").insert(batch)
    if (error) {
      console.error(`  ✗ Lote ${Math.floor(i / BATCH) + 1}: ${error.message}`)
      errors += batch.length
    } else {
      inserted += batch.length
      console.log(`  ✓ Lote ${Math.floor(i / BATCH) + 1}: ${batch.length} insertados`)
    }
  }

  console.log(`\nListo. ${inserted} insertados, ${errors} con error.`)
}

run()
