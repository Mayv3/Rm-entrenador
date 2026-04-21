/**
 * Migra las imágenes de ejercicios_movilidad desde Google Drive a Supabase Storage.
 * Uso: node backend/scripts/migrateMovilidadImages.js
 *
 * Requiere bucket público "movilidad" creado en Supabase Storage.
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el .env (para poder subir archivos).
 */

import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, "../.env") })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BUCKET = "movilidad"

function extractDriveId(url) {
  const m = url?.match(/[?&]id=([^&\s]+)/)
  return m ? m[1] : null
}

async function downloadImage(driveUrl) {
  // Use the thumbnail endpoint which works without auth for public files
  const id = extractDriveId(driveUrl)
  if (!id) throw new Error(`No se pudo extraer ID de: ${driveUrl}`)

  const fetchUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w800`
  const res = await fetch(fetchUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${fetchUrl}`)

  const contentType = res.headers.get("content-type") || "image/jpeg"
  const buffer = await res.arrayBuffer()
  return { buffer: Buffer.from(buffer), contentType }
}

async function run() {
  // 1. Traer todos los ejercicios
  const { data: ejercicios, error } = await supabase
    .from("ejercicios_movilidad")
    .select("id, nombre, imagen_url")
    .order("id")

  if (error) {
    console.error("Error al obtener ejercicios:", error.message)
    process.exit(1)
  }

  console.log(`\nEjercicios encontrados: ${ejercicios.length}\n`)

  for (const ej of ejercicios) {
    if (!ej.imagen_url) {
      console.log(`  [${ej.id}] ${ej.nombre} — sin URL, salteando`)
      continue
    }

    // Si ya es una URL de Supabase, saltar
    if (ej.imagen_url.includes("supabase")) {
      console.log(`  [${ej.id}] ${ej.nombre} — ya migrada ✓`)
      continue
    }

    try {
      // 2. Descargar imagen
      process.stdout.write(`  [${ej.id}] ${ej.nombre} — descargando...`)
      const { buffer, contentType } = await downloadImage(ej.imagen_url)

      const ext = contentType.includes("png") ? "png" : "jpg"
      const fileName = `${ej.id}-${ej.nombre.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.${ext}`

      // 3. Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, buffer, {
          contentType,
          upsert: true,
        })

      if (uploadError) throw new Error(uploadError.message)

      // 4. Obtener URL pública
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl

      // 5. Actualizar DB
      const { error: updateError } = await supabase
        .from("ejercicios_movilidad")
        .update({ imagen_url: publicUrl })
        .eq("id", ej.id)

      if (updateError) throw new Error(updateError.message)

      console.log(` ✓ ${publicUrl}`)
    } catch (err) {
      console.log(` ❌ Error: ${err.message}`)
    }

    // Pequeña pausa para no saturar Drive
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log("\n¡Migración completada!")
}

run()
