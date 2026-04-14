/**
 * fix-ultima-antro.js
 *
 * Actualiza alumnos.ultima_antro para que coincida con la fecha real
 * de la última antropometría de cada alumno.
 *
 * Lógica de fecha: usa antropometrias.fecha si existe, sino created_at.
 * Misma lógica que el ORDER BY en getAntrosByAlumno.
 *
 * Uso: node backend/scripts/fix-ultima-antro.js
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);

async function main() {
  console.log("Obteniendo todas las antropometrías...");

  const { data: antros, error: antrosError } = await supabase
    .from("antropometrias")
    .select("alumno_id, fecha, created_at")
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (antrosError) {
    console.error("Error al obtener antropometrías:", antrosError.message);
    process.exit(1);
  }

  // Para cada alumno, determinar su fecha más reciente
  // (misma lógica que el ORDER BY del backend: fecha DESC nullsFirst:false, luego created_at DESC)
  const latestPerAlumno = {};
  for (const antro of antros) {
    if (latestPerAlumno[antro.alumno_id]) continue; // ya tenemos la más reciente
    const fechaBase = antro.fecha
      ? antro.fecha
      : new Date(antro.created_at).toLocaleDateString("en-CA", {
          timeZone: "America/Argentina/Buenos_Aires",
        });
    const d = new Date(fechaBase + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const fechaEfectiva = d.toISOString().split("T")[0];
    latestPerAlumno[antro.alumno_id] = fechaEfectiva;
  }

  const alumnoIds = Object.keys(latestPerAlumno);
  console.log(`Alumnos con antropometrías: ${alumnoIds.length}`);

  // Obtener ultima_antro actual de cada alumno para comparar
  const { data: alumnos, error: alumnosError } = await supabase
    .from("alumnos")
    .select("id, nombre, ultima_antro")
    .in("id", alumnoIds);

  if (alumnosError) {
    console.error("Error al obtener alumnos:", alumnosError.message);
    process.exit(1);
  }

  let actualizados = 0;
  let sinCambios = 0;

  for (const alumno of alumnos) {
    const fechaCorrecta = latestPerAlumno[alumno.id];
    const fechaActual = alumno.ultima_antro;

    if (fechaActual === fechaCorrecta) {
      console.log(`  OK  ${alumno.nombre}: ${fechaActual} (sin cambios)`);
      sinCambios++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("alumnos")
      .update({ ultima_antro: fechaCorrecta })
      .eq("id", alumno.id);

    if (updateError) {
      console.error(`  ERROR  ${alumno.nombre}:`, updateError.message);
    } else {
      console.log(
        `  ACTUALIZADO  ${alumno.nombre}: ${fechaActual ?? "null"} → ${fechaCorrecta}`
      );
      actualizados++;
    }
  }

  console.log(`\nResultado: ${actualizados} actualizados, ${sinCambios} sin cambios.`);
}

main();
