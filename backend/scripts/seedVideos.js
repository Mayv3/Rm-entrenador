/**
 * Script para cargar video_url en los ejercicios base.
 * Uso: node backend/scripts/seedVideos.js
 *
 * Completá cada "url" con el link de YouTube correspondiente.
 * Dejá "" para no actualizar ese ejercicio.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY
);

const videos = [
  // ── Bíceps ────────────────────────────────────────────────────────────────
  { id: 29, nombre: "Curl con barra recta",         url: "" },
  { id: 30, nombre: "Curl con barra Z",              url: "" },
  { id: 31, nombre: "Curl con mancuernas",           url: "" },
  { id: 35, nombre: "Curl concentrado",              url: "" },
  { id: 33, nombre: "Curl en banco Scott",           url: "" },
  { id: 34, nombre: "Curl en polea baja",            url: "" },
  { id: 32, nombre: "Curl martillo",                 url: "" },

  // ── Core ──────────────────────────────────────────────────────────────────
  { id: 65, nombre: "Crunch abdominal",              url: "" },
  { id: 66, nombre: "Crunch en polea",               url: "" },
  { id: 71, nombre: "Dead bug",                      url: "" },
  { id: 67, nombre: "Elevación de piernas colgado",  url: "" },
  { id: 68, nombre: "Elevación de piernas en suelo", url: "" },
  { id: 72, nombre: "Pallof press",                  url: "" },
  { id: 63, nombre: "Plancha frontal",               url: "" },
  { id: 64, nombre: "Plancha lateral",               url: "" },
  { id: 70, nombre: "Rueda abdominal",               url: "" },
  { id: 69, nombre: "Russian twist",                 url: "" },

  // ── Cuádriceps ────────────────────────────────────────────────────────────
  { id: 47, nombre: "Extensión de cuádriceps",       url: "" },
  { id: 48, nombre: "Hack squat",                    url: "" },
  { id: 46, nombre: "Prensa de piernas",             url: "" },
  { id: 45, nombre: "Sentadilla búlgara",            url: "" },
  { id: 43, nombre: "Sentadilla con barra",          url: "" },
  { id: 44, nombre: "Sentadilla frontal",            url: "" },
  { id: 49, nombre: "Zancada con barra",             url: "" },
  { id: 50, nombre: "Zancada con mancuernas",        url: "" },

  // ── Espalda ───────────────────────────────────────────────────────────────
  { id: 12, nombre: "Dominadas",                         url: "" },
  { id: 19, nombre: "Face pull",                         url: "" },
  { id: 14, nombre: "Jalón al pecho agarre neutro",      url: "" },
  { id: 13, nombre: "Jalón al pecho en polea",           url: "" },
  { id: 10, nombre: "Peso muerto convencional",          url: "" },
  { id: 11, nombre: "Peso muerto sumo",                  url: "" },
  { id: 20, nombre: "Pull over con mancuerna",           url: "" },
  { id: 15, nombre: "Remo con barra",                    url: "" },
  { id: 16, nombre: "Remo con mancuerna",                url: "" },
  { id: 18, nombre: "Remo en máquina",                   url: "" },
  { id: 17, nombre: "Remo en polea baja",                url: "" },

  // ── Gemelos ───────────────────────────────────────────────────────────────
  { id: 60, nombre: "Elevación de talones de pie",      url: "" },
  { id: 62, nombre: "Elevación de talones en prensa",   url: "" },
  { id: 61, nombre: "Elevación de talones sentado",     url: "" },

  // ── Glúteos ───────────────────────────────────────────────────────────────
  { id: 59, nombre: "Abducción en máquina",             url: "" },
  { id: 51, nombre: "Hip thrust con barra",             url: "" },
  { id: 52, nombre: "Hip thrust en máquina",            url: "" },
  { id: 58, nombre: "Patada de glúteo en polea",        url: "" },

  // ── Hombros ───────────────────────────────────────────────────────────────
  { id: 26, nombre: "Elevación frontal con mancuernas", url: "" },
  { id: 24, nombre: "Elevación lateral con mancuernas", url: "" },
  { id: 25, nombre: "Elevación lateral en polea",       url: "" },
  { id: 28, nombre: "Encogimiento de hombros",          url: "" },
  { id: 27, nombre: "Pájaros con mancuernas",           url: "" },
  { id: 23, nombre: "Press Arnold",                     url: "" },
  { id: 21, nombre: "Press militar con barra",          url: "" },
  { id: 22, nombre: "Press militar con mancuernas",     url: "" },

  // ── Isquiotibiales ────────────────────────────────────────────────────────
  { id: 56, nombre: "Curl femoral sentado",             url: "" },
  { id: 55, nombre: "Curl femoral tumbado",             url: "" },
  { id: 57, nombre: "Good morning",                     url: "" },
  { id: 54, nombre: "Peso muerto piernas rígidas",      url: "" },
  { id: 53, nombre: "Peso muerto rumano",               url: "" },

  // ── Pecho ─────────────────────────────────────────────────────────────────
  { id: 6,  nombre: "Apertura con mancuernas",          url: "" },
  { id: 7,  nombre: "Apertura en polea",                url: "" },
  { id: 9,  nombre: "Crossover en polea",               url: "" },
  { id: 8,  nombre: "Fondos en paralelas",              url: "" },
  { id: 4,  nombre: "Press con mancuernas",             url: "" },
  { id: 1,  nombre: "Press de banca con barra",         url: "" },
  { id: 3,  nombre: "Press declinado con barra",        url: "" },
  { id: 2,  nombre: "Press inclinado con barra",        url: "" },
  { id: 5,  nombre: "Press inclinado con mancuernas",   url: "" },

  // ── Tríceps ───────────────────────────────────────────────────────────────
  { id: 38, nombre: "Extensión en polea alta",          url: "" },
  { id: 39, nombre: "Extensión en polea con cuerda",    url: "" },
  { id: 40, nombre: "Fondos cerrados",                  url: "" },
  { id: 41, nombre: "Patada de tríceps",                url: "" },
  { id: 42, nombre: "Press cerrado",                    url: "" },
  { id: 36, nombre: "Press francés con barra",          url: "" },
  { id: 37, nombre: "Press francés con mancuernas",     url: "" },
];

async function run() {
  const toUpdate = videos.filter((v) => v.url.trim() !== "");

  if (toUpdate.length === 0) {
    console.log("No hay URLs para actualizar. Completá los campos 'url' en el script.");
    return;
  }

  console.log(`Actualizando ${toUpdate.length} ejercicios...`);

  for (const { id, nombre, url } of toUpdate) {
    const { error } = await supabase
      .from("ejercicios")
      .update({ video_url: url })
      .eq("id", id);

    if (error) {
      console.error(`  ✗ [${id}] ${nombre}: ${error.message}`);
    } else {
      console.log(`  ✓ [${id}] ${nombre}`);
    }
  }

  console.log("Listo.");
}

run();
