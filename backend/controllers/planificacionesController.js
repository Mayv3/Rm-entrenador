import { supabase } from "../lib/supabase.js";
import { cache } from "../lib/cache.js";

// Claves de cache
const KEYS = {
  ejercicios: "ejercicios",
  ejerciciosMovilidad: "ejercicios_movilidad",
  planificaciones: "planificaciones",
  plan: (id) => `plan:${id}`,
}

// Invalida todo lo relacionado a planes (llamar en cualquier escritura que modifique un plan)
function invalidatePlanes(planId) {
  cache.del(KEYS.planificaciones)
  if (planId) cache.del(KEYS.plan(planId))
  else cache.delByPrefix("plan:")
}

// ─── EJERCICIOS ───────────────────────────────────────────────────────────────

export async function getEjercicios(req, res) {
  const cached = cache.get(KEYS.ejercicios)
  if (cached) return res.json(cached)

  const { data, error } = await supabase
    .from("ejercicios")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  cache.set(KEYS.ejercicios, data)
  res.json(data);
}

export async function createEjercicio(req, res) {
  const { nombre, grupo_muscular, video_url } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

  const { data, error } = await supabase
    .from("ejercicios")
    .insert([{ nombre, grupo_muscular: grupo_muscular ?? null, video_url: video_url ?? null, es_base: false }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  cache.del(KEYS.ejercicios)
  res.status(201).json(data);
}

export async function updateEjercicio(req, res) {
  const { id } = req.params;
  const { nombre, grupo_muscular, video_url } = req.body;

  const { data, error } = await supabase
    .from("ejercicios")
    .update({ nombre, grupo_muscular, video_url })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  cache.del(KEYS.ejercicios)
  cache.delByPrefix("plan:") // los nombres de ejercicios aparecen en los planes
  res.json(data);
}

export async function deleteEjercicio(req, res) {
  const { id } = req.params;
  const { error } = await supabase
    .from("ejercicios")
    .delete()
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  cache.del(KEYS.ejercicios)
  cache.delByPrefix("plan:")
  res.json({ ok: true });
}

// ─── PLANIFICACIONES ──────────────────────────────────────────────────────────

export async function getPlanificaciones(req, res) {
  const cached = cache.get(KEYS.planificaciones)
  if (cached) return res.json(cached)

  const { data, error } = await supabase
    .from("planificaciones")
    .select("*, alumnos(id, nombre), planificacion_hojas!planificacion_id(id, nombre, numero, estado)")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  cache.set(KEYS.planificaciones, data)
  res.json(data);
}

export async function getPlanificacionesByAlumno(req, res) {
  const { alumnoId } = req.params;
  const { data, error } = await supabase
    .from("planificaciones")
    .select("*")
    .eq("alumno_id", alumnoId)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function getPlanificacionById(req, res) {
  const { id } = req.params;

  const cached = cache.get(KEYS.plan(id))
  if (cached) return res.json(cached)

  // 1. Get plan
  const { data: plan, error: planError } = await supabase
    .from("planificaciones")
    .select("*, alumnos(id, nombre)")
    .eq("id", id)
    .single();

  if (planError) return res.status(500).json({ error: planError.message });
  if (!plan) return res.status(404).json({ error: "Planificación no encontrada" });

  // 2. Get hojas ordered by numero
  const { data: hojas, error: hojasError } = await supabase
    .from("planificacion_hojas")
    .select("*")
    .eq("planificacion_id", id)
    .order("numero", { ascending: true });

  if (hojasError) return res.status(500).json({ error: hojasError.message });

  // 3. If no hojas, return early
  if (!hojas || hojas.length === 0) {
    return res.json({ ...plan, hojas: [] });
  }

  const hojaIds = hojas.map((h) => h.id);

  // 4. Get dias filtered by hoja_id IN hojaIds
  const { data: dias, error: diasError } = await supabase
    .from("planificacion_dias")
    .select("*")
    .in("hoja_id", hojaIds)
    .order("orden", { ascending: true });

  if (diasError) return res.status(500).json({ error: diasError.message });

  if (!dias || dias.length === 0) {
    return res.json({ ...plan, hojas: hojas.map((h) => ({ ...h, dias: [] })) });
  }

  const diaIds = dias.map((d) => d.id);

  // 5. Get ejercicios filtered by planificacion_dia_id IN diaIds
  const { data: ejercicios, error: ejerciciosError } = await supabase
    .from("planificacion_ejercicios")
    .select("*, ejercicios(id, nombre, grupo_muscular, video_url)")
    .in("planificacion_dia_id", diaIds)
    .order("orden", { ascending: true });

  if (ejerciciosError) return res.status(500).json({ error: ejerciciosError.message });

  const ejercicioIds = (ejercicios ?? []).map((e) => e.id);

  // 6. Get semanas filtered by planificacion_ejercicio_id IN ejercicioIds
  let semanas = [];
  if (ejercicioIds.length > 0) {
    const { data: semanasData, error: semanasError } = await supabase
      .from("planificacion_semanas")
      .select("*")
      .in("planificacion_ejercicio_id", ejercicioIds)
      .order("semana", { ascending: true });

    if (semanasError) return res.status(500).json({ error: semanasError.message });
    semanas = semanasData ?? [];
  }

  // 7. Get movilidad for all hojas
  const { data: movilidadData } = await supabase
    .from("planificacion_movilidad")
    .select("*")
    .in("hoja_id", hojaIds)
    .order("orden", { ascending: true });

  const movilidad = movilidadData ?? [];

  // 8. Build nested structure: hojas → dias → ejercicios → semanas + movilidad
  const hojasCompletas = hojas.map((hoja) => ({
    ...hoja,
    movilidad: movilidad.filter((m) => m.hoja_id === hoja.id),
    dias: dias
      .filter((d) => d.hoja_id === hoja.id)
      .map((dia) => ({
        ...dia,
        ejercicios: (ejercicios ?? [])
          .filter((e) => e.planificacion_dia_id === dia.id)
          .map((ej) => ({
            ...ej,
            semanas: semanas.filter((s) => s.planificacion_ejercicio_id === ej.id),
          })),
      })),
  }));

  const result = { ...plan, hojas: hojasCompletas }
  cache.set(KEYS.plan(id), result)
  res.json(result);
}

export async function createPlanificacion(req, res) {
  const { nombre, alumno_id } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

  const { data, error } = await supabase
    .from("planificaciones")
    .insert([{ nombre, alumno_id: alumno_id ?? null, semanas: 6, estado: "borrador" }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // After creating plan, also create a default "Hoja 1"
  await supabase
    .from("planificacion_hojas")
    .insert([{ planificacion_id: data.id, nombre: "Hoja 1", numero: 1, estado: "activa" }]);

  invalidatePlanes()
  res.status(201).json(data);
}

export async function updatePlanificacion(req, res) {
  const { id } = req.params;
  const { nombre, alumno_id, estado, hoja_activa_id } = req.body;

  const { data, error } = await supabase
    .from("planificaciones")
    .update({ nombre, alumno_id, estado, hoja_activa_id: hoja_activa_id ?? null })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes(id)
  res.json(data);
}

export async function deletePlanificacion(req, res) {
  const { id } = req.params;
  const { error } = await supabase
    .from("planificaciones")
    .delete()
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes(id)
  res.json({ ok: true });
}

// ─── HOJAS ────────────────────────────────────────────────────────────────────

export async function createHoja(req, res) {
  const { id: planificacion_id } = req.params;
  const { nombre, numero } = req.body;
  const { data, error } = await supabase
    .from("planificacion_hojas")
    .insert([{ planificacion_id, nombre, numero, estado: "activa" }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes(planificacion_id)
  res.status(201).json(data);
}

export async function updateHoja(req, res) {
  const { hojaId } = req.params;
  const { nombre, estado } = req.body;
  const { data, error } = await supabase
    .from("planificacion_hojas")
    .update({ nombre, estado })
    .eq("id", hojaId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes()
  res.json(data);
}

export async function deleteHoja(req, res) {
  const { hojaId } = req.params;
  const { error } = await supabase
    .from("planificacion_hojas")
    .delete()
    .eq("id", hojaId);
  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes()
  res.json({ ok: true });
}

// ─── DÍAS ─────────────────────────────────────────────────────────────────────

export async function createDia(req, res) {
  const { hojaId } = req.params;
  const { numero_dia, nombre, orden } = req.body;

  if (!nombre) return res.status(400).json({ error: "El nombre del día es obligatorio" });

  const { data, error } = await supabase
    .from("planificacion_dias")
    .insert([{ hoja_id: hojaId, numero_dia: numero_dia ?? 1, nombre, orden: orden ?? 0 }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes()
  res.status(201).json(data);
}

export async function updateDia(req, res) {
  const { diaId } = req.params;
  const { nombre, orden } = req.body;

  const { data, error } = await supabase
    .from("planificacion_dias")
    .update({ nombre, orden })
    .eq("id", diaId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes()
  res.json(data);
}

export async function deleteDia(req, res) {
  const { diaId } = req.params;
  const { error } = await supabase
    .from("planificacion_dias")
    .delete()
    .eq("id", diaId);
  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes()
  res.json({ ok: true });
}

// ─── EJERCICIOS EN UN DÍA ─────────────────────────────────────────────────────

export async function addEjercicioADia(req, res) {
  const { diaId } = req.params;
  const { ejercicio_id, categoria, orden } = req.body;

  if (!ejercicio_id) return res.status(400).json({ error: "ejercicio_id es obligatorio" });

  const { data: planEj, error: insertError } = await supabase
    .from("planificacion_ejercicios")
    .insert([{
      planificacion_dia_id: diaId,
      ejercicio_id,
      categoria: categoria ?? "A",
      orden: orden ?? 0,
    }])
    .select("*, ejercicios(id, nombre, grupo_muscular, video_url)")
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  const semanasRows = Array.from({ length: 6 }, (_, i) => ({
    planificacion_ejercicio_id: planEj.id,
    semana: i + 1,
    dosis: null,
  }));

  const { error: semanasError } = await supabase
    .from("planificacion_semanas")
    .insert(semanasRows);

  if (semanasError) return res.status(500).json({ error: semanasError.message });

  const { data: semanas } = await supabase
    .from("planificacion_semanas")
    .select("*")
    .eq("planificacion_ejercicio_id", planEj.id)
    .order("semana", { ascending: true });

  invalidatePlanes()
  res.status(201).json({ ...planEj, semanas: semanas ?? [] });
}

export async function updateEjercicioEnDia(req, res) {
  const { planEjId } = req.params;
  const { categoria, orden } = req.body;

  const { data, error } = await supabase
    .from("planificacion_ejercicios")
    .update({ categoria, orden })
    .eq("id", planEjId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function removeEjercicioDeDia(req, res) {
  const { planEjId } = req.params;
  const { error } = await supabase
    .from("planificacion_ejercicios")
    .delete()
    .eq("id", planEjId);
  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes()
  res.json({ ok: true });
}

// ─── GUARDAR PLAN COMPLETO ────────────────────────────────────────────────────
// Actualiza semanas y categorías de todos los ejercicios ya guardados en un solo request

export async function guardarPlanCompleto(req, res) {
  const { id } = req.params;
  // semanas: [{ planificacion_ejercicio_id, semana, dosis, rpe }]
  // categorias: [{ planificacion_ejercicio_id, categoria }]
  const { semanas = [], categorias = [] } = req.body;

  const ops = [];

  // Upsert semanas (insert si no existe, update si ya existe)
  for (const s of semanas) {
    ops.push(
      supabase
        .from("planificacion_semanas")
        .upsert(
          {
            planificacion_ejercicio_id: s.planificacion_ejercicio_id,
            semana: s.semana,
            dosis: s.dosis || null,
            rpe: s.rpe ?? null,
          },
          { onConflict: "planificacion_ejercicio_id,semana" }
        )
    );
  }

  // Actualizar categorías en paralelo
  for (const c of categorias) {
    ops.push(
      supabase
        .from("planificacion_ejercicios")
        .update({ categoria: c.categoria })
        .eq("id", c.planificacion_ejercicio_id)
    );
  }

  const results = await Promise.all(ops);
  const failed = results.find((r) => r.error);
  if (failed) {
    console.error("❌ guardarPlanCompleto error:", failed.error.message);
    return res.status(500).json({ error: failed.error.message });
  }

  invalidatePlanes(id)
  res.json({ ok: true });
}

// ─── BULK: varios ejercicios + dosis en una sola llamada ─────────────────────

export async function addEjerciciosADiaBulk(req, res) {
  const { diaId } = req.params;
  // ejercicios: [{ ejercicio_id, categoria, orden, semanas: [{ semana, dosis }] }]
  const { ejercicios } = req.body;

  if (!Array.isArray(ejercicios) || ejercicios.length === 0) {
    return res.status(400).json({ error: "ejercicios debe ser un array no vacío" });
  }

  // 1. Insertar todos los planificacion_ejercicios de una vez
  const ejRows = ejercicios.map((e, i) => ({
    planificacion_dia_id: diaId,
    ejercicio_id: e.ejercicio_id,
    categoria: e.categoria ?? "A",
    orden: e.orden ?? i,
  }));

  const { data: insertedEjs, error: ejError } = await supabase
    .from("planificacion_ejercicios")
    .insert(ejRows)
    .select("id, ejercicio_id, categoria, orden");

  if (ejError) return res.status(500).json({ error: ejError.message });

  // 2. Construir todas las filas de semanas
  const semanasRows = [];
  insertedEjs.forEach((ej, idx) => {
    const semanas = ejercicios[idx]?.semanas ?? [];
    for (let s = 1; s <= 6; s++) {
      const found = semanas.find((sw) => sw.semana === s);
      semanasRows.push({
        planificacion_ejercicio_id: ej.id,
        semana: s,
        dosis: found?.dosis ?? null,
        rpe: found?.rpe ?? null,
      });
    }
  });

  const { error: semError } = await supabase
    .from("planificacion_semanas")
    .insert(semanasRows);

  if (semError) return res.status(500).json({ error: semError.message });

  invalidatePlanes()
  res.status(201).json({ inserted: insertedEjs.length });
}

// ─── LIBRERÍA DE MOVILIDAD ────────────────────────────────────────────────────

export async function getEjerciciosMovilidad(req, res) {
  const cached = cache.get(KEYS.ejerciciosMovilidad)
  if (cached) return res.json(cached)

  const { data, error } = await supabase
    .from("ejercicios_movilidad")
    .select("*")
    .order("nombre", { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  cache.set(KEYS.ejerciciosMovilidad, data)
  res.json(data)
}

// ─── MOVILIDAD ────────────────────────────────────────────────────────────────

export async function saveMovilidad(req, res) {
  const { hojaId } = req.params;
  // items: [{ nombre, imagen_url, orden }]
  const { items = [] } = req.body;

  // Delete existing and reinsert (simplest for a small fixed set)
  const { error: delError } = await supabase
    .from("planificacion_movilidad")
    .delete()
    .eq("hoja_id", hojaId);

  if (delError) return res.status(500).json({ error: delError.message });

  if (items.length === 0) return res.json({ ok: true });

  const rows = items.map((item, i) => ({
    hoja_id: Number(hojaId),
    nombre: item.nombre,
    imagen_url: item.imagen_url || null,
    orden: i,
  }));

  const { error: insError } = await supabase
    .from("planificacion_movilidad")
    .insert(rows);

  if (insError) return res.status(500).json({ error: insError.message });

  invalidatePlanes()
  res.json({ ok: true });
}

// ─── SAVE ALL: inserts + semanas + deletes + orden en una sola llamada ───────

export async function saveAll(req, res) {
  const { id } = req.params
  const {
    pendingByDay = {},   // { [diaId]: [{ ejercicio_id, categoria, orden, semanas }] }
    semanas = [],        // [{ planificacion_ejercicio_id, semana, dosis, rpe }]
    categorias = [],     // [{ planificacion_ejercicio_id, categoria }]
    deletes = [],        // [planEjId]
    orden = [],          // [{ id, orden }]
  } = req.body

  const ops = []

  // 1. Bulk inserts por día
  for (const [diaId, ejercicios] of Object.entries(pendingByDay)) {
    if (!ejercicios.length) continue

    ops.push((async () => {
      const ejRows = ejercicios.map((e, i) => ({
        planificacion_dia_id: diaId,
        ejercicio_id: e.ejercicio_id,
        categoria: e.categoria ?? "A",
        orden: e.orden ?? i,
      }))

      const { data: insertedEjs, error: ejError } = await supabase
        .from("planificacion_ejercicios")
        .insert(ejRows)
        .select("id, ejercicio_id, categoria, orden")

      if (ejError) throw new Error(ejError.message)

      const semanasRows = []
      insertedEjs.forEach((ej, idx) => {
        const sems = ejercicios[idx]?.semanas ?? []
        for (let s = 1; s <= 6; s++) {
          const found = sems.find((sw) => sw.semana === s)
          semanasRows.push({
            planificacion_ejercicio_id: ej.id,
            semana: s,
            dosis: found?.dosis ?? null,
            rpe: found?.rpe ?? null,
          })
        }
      })

      const { error: semError } = await supabase.from("planificacion_semanas").insert(semanasRows)
      if (semError) throw new Error(semError.message)
    })())
  }

  // 2. Upsert semanas + categorías de ejercicios existentes
  if (semanas.length > 0 || categorias.length > 0) {
    ops.push((async () => {
      const innerOps = []
      for (const s of semanas) {
        innerOps.push(
          supabase.from("planificacion_semanas").upsert(
            { planificacion_ejercicio_id: s.planificacion_ejercicio_id, semana: s.semana, dosis: s.dosis || null, rpe: s.rpe ?? null },
            { onConflict: "planificacion_ejercicio_id,semana" }
          )
        )
      }
      for (const c of categorias) {
        innerOps.push(
          supabase.from("planificacion_ejercicios").update({ categoria: c.categoria }).eq("id", c.planificacion_ejercicio_id)
        )
      }
      const results = await Promise.all(innerOps)
      const failed = results.find((r) => r.error)
      if (failed) throw new Error(failed.error.message)
    })())
  }

  // 3. Deletes
  if (deletes.length > 0) {
    ops.push((async () => {
      const { error } = await supabase.from("planificacion_ejercicios").delete().in("id", deletes)
      if (error) throw new Error(error.message)
    })())
  }

  // 4. Bulk orden
  if (orden.length > 0) {
    ops.push((async () => {
      const results = await Promise.all(
        orden.map(({ id, orden: o }) =>
          supabase.from("planificacion_ejercicios").update({ orden: o }).eq("id", id)
        )
      )
      const failed = results.find((r) => r.error)
      if (failed) throw new Error(failed.error.message)
    })())
  }

  try {
    await Promise.all(ops)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  invalidatePlanes(id)
  res.json({ ok: true })
}

// ─── BULK: actualizar orden de ejercicios en un solo request ─────────────────

export async function bulkUpdateOrden(req, res) {
  // ejercicios: [{ id, orden }]
  const { ejercicios } = req.body;

  if (!Array.isArray(ejercicios) || ejercicios.length === 0) {
    return res.status(400).json({ error: "ejercicios debe ser un array no vacío" });
  }

  const ops = ejercicios.map(({ id, orden }) =>
    supabase
      .from("planificacion_ejercicios")
      .update({ orden })
      .eq("id", id)
  );

  const results = await Promise.all(ops);
  const failed = results.find((r) => r.error);
  if (failed) return res.status(500).json({ error: failed.error.message });

  invalidatePlanes()
  res.json({ ok: true });
}

// ─── DOSIS POR SEMANA ─────────────────────────────────────────────────────────

export async function updateDosis(req, res) {
  const { planEjId, semana } = req.params;
  const { dosis, rpe } = req.body;

  const { data, error } = await supabase
    .from("planificacion_semanas")
    .update({ dosis, rpe: rpe ?? null })
    .eq("planificacion_ejercicio_id", planEjId)
    .eq("semana", semana)
    .select()
    .single();

  if (error) {
    console.error("❌ updateDosis error:", error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
}

export async function updateDosisBulk(req, res) {
  const { planEjId } = req.params;
  const { semanas } = req.body;

  if (!Array.isArray(semanas)) {
    return res.status(400).json({ error: "semanas debe ser un array" });
  }

  const updates = semanas.map(({ semana, dosis, rpe }) =>
    supabase
      .from("planificacion_semanas")
      .update({ dosis, rpe: rpe ?? null })
      .eq("planificacion_ejercicio_id", planEjId)
      .eq("semana", semana)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed) return res.status(500).json({ error: failed.error.message });

  res.json({ ok: true });
}
