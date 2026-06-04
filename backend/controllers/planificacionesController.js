import { supabase } from "../lib/supabase.js";
import { cache } from "../lib/cache.js";

// Claves de cache
const KEYS = {
  ejercicios: "ejercicios",
  tiposEjercicio: "tipos_ejercicio",
  ejerciciosMovilidad: "ejercicios_movilidad",
  planificaciones: "planificaciones",
  plan: (id) => `plan:${id}`,
}

// Invalida todo lo relacionado a planes (llamar en cualquier escritura que modifique un plan)
function invalidatePlanes(planId) {
  cache.del(KEYS.planificaciones)
  if (planId) cache.del(KEYS.plan(planId))
  else cache.delByPrefix("plan:")
  cache.delByPrefix("ej_dia:")
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

// ─── TIPOS DE EJERCICIO (grupos musculares) ───────────────────────────────────

export async function getTiposEjercicio(req, res) {
  const cached = cache.get(KEYS.tiposEjercicio)
  if (cached) return res.json(cached)

  const { data, error } = await supabase
    .from("tipos_ejercicio")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  cache.set(KEYS.tiposEjercicio, data)
  res.json(data);
}

export async function createTipoEjercicio(req, res) {
  const nombre = (req.body?.nombre ?? "").trim();
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

  const { data, error } = await supabase
    .from("tipos_ejercicio")
    .insert([{ nombre }])
    .select("id, nombre")
    .single();

  // Si ya existe (índice único case-insensitive), devolver el existente
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("tipos_ejercicio")
        .select("id, nombre")
        .ilike("nombre", nombre)
        .limit(1)
        .maybeSingle();
      if (existing) return res.status(200).json(existing);
    }
    return res.status(500).json({ error: error.message });
  }

  cache.del(KEYS.tiposEjercicio)
  res.status(201).json(data);
}

export async function updateTipoEjercicio(req, res) {
  const { id } = req.params;
  const nombre = (req.body?.nombre ?? "").trim();
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

  // Nombre actual, para propagar el cambio a los ejercicios que lo usan
  const { data: actual, error: getErr } = await supabase
    .from("tipos_ejercicio")
    .select("nombre")
    .eq("id", id)
    .single();
  if (getErr) return res.status(404).json({ error: "Tipo no encontrado" });

  const { data, error } = await supabase
    .from("tipos_ejercicio")
    .update({ nombre })
    .eq("id", id)
    .select("id, nombre")
    .single();

  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ya existe un tipo con ese nombre" });
    return res.status(500).json({ error: error.message });
  }

  // Cascada: el tipo se guarda como string en ejercicios.grupo_muscular
  if (actual.nombre !== nombre) {
    await supabase
      .from("ejercicios")
      .update({ grupo_muscular: nombre })
      .eq("grupo_muscular", actual.nombre);
    cache.del(KEYS.ejercicios)
    cache.delByPrefix("plan:") // grupo_muscular viaja anidado en los planes
  }
  cache.del(KEYS.tiposEjercicio)
  res.json(data);
}

export async function deleteTipoEjercicio(req, res) {
  const { id } = req.params;

  const { data: actual } = await supabase
    .from("tipos_ejercicio")
    .select("nombre")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("tipos_ejercicio")
    .delete()
    .eq("id", id);
  if (error) return res.status(500).json({ error: error.message });

  // Los ejercicios que usaban este tipo quedan sin categoría
  if (actual?.nombre) {
    await supabase
      .from("ejercicios")
      .update({ grupo_muscular: null })
      .eq("grupo_muscular", actual.nombre);
    cache.del(KEYS.ejercicios)
    cache.delByPrefix("plan:")
  }
  cache.del(KEYS.tiposEjercicio)
  res.json({ ok: true });
}

// ─── PLANIFICACIONES ──────────────────────────────────────────────────────────

export async function getPlanificaciones(req, res) {
  const cached = cache.get(KEYS.planificaciones)
  if (cached) return res.json(cached)

  // IDs de planificaciones que son workspace de plantillas (excluir)
  const { data: workspaceRefs } = await supabase
    .from("planificacion_plantillas")
    .select("workspace_plan_id")
    .not("workspace_plan_id", "is", null)
  const workspaceIds = (workspaceRefs ?? []).map((r) => r.workspace_plan_id)

  let query = supabase
    .from("planificaciones")
    .select("*, alumnos(id, nombre), planificacion_hojas!planificacion_id(id, nombre, numero, estado)")
    .order("created_at", { ascending: false });

  if (workspaceIds.length > 0) {
    query = query.not("id", "in", `(${workspaceIds.join(",")})`)
  }

  const { data, error } = await query
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

  // 1. Plan + hojas en paralelo
  const [planRes, hojasRes] = await Promise.all([
    supabase.from("planificaciones").select("*, alumnos(id, nombre)").eq("id", id).single(),
    supabase.from("planificacion_hojas").select("*").eq("planificacion_id", id).order("numero", { ascending: true }),
  ]);

  if (planRes.error) return res.status(500).json({ error: planRes.error.message });
  if (!planRes.data) return res.status(404).json({ error: "Planificación no encontrada" });
  if (hojasRes.error) return res.status(500).json({ error: hojasRes.error.message });

  const plan = planRes.data;
  const hojas = hojasRes.data ?? [];

  if (hojas.length === 0) {
    return res.json({ ...plan, hojas: [] });
  }

  const hojaIds = hojas.map((h) => h.id);

  // 2. Dias + movilidad en paralelo
  const [diasRes, movRes] = await Promise.all([
    supabase.from("planificacion_dias").select("*").in("hoja_id", hojaIds).order("orden", { ascending: true }),
    supabase.from("planificacion_movilidad").select("*").in("hoja_id", hojaIds).order("orden", { ascending: true }),
  ]);

  if (diasRes.error) return res.status(500).json({ error: diasRes.error.message });
  const dias = diasRes.data ?? [];
  const movilidad = movRes.data ?? [];

  if (dias.length === 0) {
    return res.json({ ...plan, hojas: hojas.map((h) => ({ ...h, dias: [], movilidad: movilidad.filter((m) => m.hoja_id === h.id) })) });
  }

  const diaIds = dias.map((d) => d.id);

  // 3. Ejercicios
  const { data: ejercicios, error: ejerciciosError } = await supabase
    .from("planificacion_ejercicios")
    .select("*, ejercicios(id, nombre, grupo_muscular, video_url)")
    .in("planificacion_dia_id", diaIds)
    .order("orden", { ascending: true });

  if (ejerciciosError) return res.status(500).json({ error: ejerciciosError.message });

  const ejercicioIds = (ejercicios ?? []).map((e) => e.id);

  // 4. Semanas
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

  let nombreFinal = typeof nombre === "string" ? nombre.trim() : "";
  const alumnoId = alumno_id ?? null;

  if (!nombreFinal && alumnoId) {
    const { data: alumno, error: alumnoError } = await supabase
      .from("alumnos")
      .select("nombre")
      .eq("id", alumnoId)
      .single();

    if (alumnoError) return res.status(500).json({ error: alumnoError.message });
    nombreFinal = `Plan de ${alumno?.nombre ?? "Alumno"}`;
  }

  if (!nombreFinal) {
    return res.status(400).json({ error: "Debes enviar nombre o alumno_id" });
  }

  const { data, error } = await supabase
    .from("planificaciones")
    .insert([{ nombre: nombreFinal, alumno_id: alumnoId, semanas: 6, estado: "borrador" }])
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
  const { nombre, orden, numero_dia } = req.body;

  const updates = {};
  if (typeof nombre === "string") updates.nombre = nombre;
  if (typeof orden === "number") updates.orden = orden;
  if (typeof numero_dia === "number") updates.numero_dia = numero_dia;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No hay campos para actualizar" });
  }

  const { data, error } = await supabase
    .from("planificacion_dias")
    .update(updates)
    .eq("id", diaId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes()
  res.json(data);
}

export async function deleteDia(req, res) {
  const { diaId } = req.params;

  const { data: dia, error: diaError } = await supabase
    .from("planificacion_dias")
    .select("id, hoja_id")
    .eq("id", diaId)
    .single();

  if (diaError) return res.status(500).json({ error: diaError.message });
  if (!dia) return res.status(404).json({ error: "Día no encontrado" });

  const { error } = await supabase
    .from("planificacion_dias")
    .delete()
    .eq("id", diaId);
  if (error) return res.status(500).json({ error: error.message });

  const { data: diasRestantes, error: restantesError } = await supabase
    .from("planificacion_dias")
    .select("id")
    .eq("hoja_id", dia.hoja_id)
    .order("orden", { ascending: true })
    .order("id", { ascending: true });

  if (restantesError) return res.status(500).json({ error: restantesError.message });

  for (const [index, diaRestante] of (diasRestantes ?? []).entries()) {
    const numeroDia = index + 1;
    const orden = index;
    const { error: updateError } = await supabase
      .from("planificacion_dias")
      .update({ numero_dia: numeroDia, orden })
      .eq("id", diaRestante.id);

    if (updateError) return res.status(500).json({ error: updateError.message });
  }

  invalidatePlanes()
  res.json({ ok: true });
}

// ─── EJERCICIOS EN UN DÍA ─────────────────────────────────────────────────────

export async function addEjercicioADia(req, res) {
  const { diaId } = req.params;
  const { ejercicio_id, categoria, orden, series } = req.body;

  if (!ejercicio_id) return res.status(400).json({ error: "ejercicio_id es obligatorio" });

  const { data: planEj, error: insertError } = await supabase
    .from("planificacion_ejercicios")
    .insert([{
      planificacion_dia_id: diaId,
      ejercicio_id,
      categoria: categoria ?? "A",
      orden: orden ?? 0,
      series: series ?? 3,
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
  const { categoria, orden, ejercicio_id, series } = req.body;

  const updates = {};
  if (categoria !== undefined) updates.categoria = categoria;
  if (orden !== undefined) updates.orden = orden;
  if (ejercicio_id !== undefined) updates.ejercicio_id = ejercicio_id;
  if (series !== undefined) updates.series = series;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No hay campos para actualizar" });
  }

  const { data, error } = await supabase
    .from("planificacion_ejercicios")
    .update(updates)
    .eq("id", planEjId)
    .select("*, ejercicios(id, nombre, grupo_muscular, video_url)")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes()
  res.json(data);
}

export async function removeEjercicioDeDia(req, res) {
  const { planEjId } = req.params;

  const { error: regError } = await supabase
    .from("entrenamiento_registros")
    .delete()
    .eq("planificacion_ejercicio_id", planEjId);
  if (regError) return res.status(500).json({ error: regError.message });

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
            notas_profesor: s.notas_profesor ?? null,
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
    series: e.series ?? 3,
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
        notas_profesor: found?.notas_profesor ?? null,
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
    pendingByDay = {},   // { [diaId]: [{ ejercicio_id, categoria, orden, series, semanas, notas_profesor }] }
    semanas = [],        // [{ planificacion_ejercicio_id, semana, dosis, rpe }]
    categorias = [],     // [{ planificacion_ejercicio_id, categoria }]
    notasProfesor = [],  // [{ planificacion_ejercicio_id, notas_profesor }]
    seriesUpdates = [],  // [{ planificacion_ejercicio_id, series }]
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
        series: e.series ?? 3,
        notas_profesor: e.notas_profesor ?? null,
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
            notas_profesor: found?.notas_profesor ?? null,
          })
        }
      })

      const { error: semError } = await supabase.from("planificacion_semanas").insert(semanasRows)
      if (semError) throw new Error(semError.message)
    })())
  }

  // 2. Upsert semanas + categorías de ejercicios existentes
  if (semanas.length > 0 || categorias.length > 0 || notasProfesor.length > 0 || seriesUpdates.length > 0) {
    ops.push((async () => {
      const innerOps = []
      for (const s of semanas) {
        innerOps.push(
          supabase.from("planificacion_semanas").upsert(
            { planificacion_ejercicio_id: s.planificacion_ejercicio_id, semana: s.semana, dosis: s.dosis || null, rpe: s.rpe ?? null, notas_profesor: s.notas_profesor ?? null },
            { onConflict: "planificacion_ejercicio_id,semana" }
          )
        )
      }
      for (const c of categorias) {
        innerOps.push(
          supabase.from("planificacion_ejercicios").update({ categoria: c.categoria }).eq("id", c.planificacion_ejercicio_id)
        )
      }
      for (const n of notasProfesor) {
        innerOps.push(
          supabase.from("planificacion_ejercicios").update({ notas_profesor: n.notas_profesor || null }).eq("id", n.planificacion_ejercicio_id)
        )
      }
      for (const su of seriesUpdates) {
        innerOps.push(
          supabase.from("planificacion_ejercicios").update({ series: su.series }).eq("id", su.planificacion_ejercicio_id)
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
      const { error: regError } = await supabase
        .from("entrenamiento_registros")
        .delete()
        .in("planificacion_ejercicio_id", deletes)
      if (regError) throw new Error(regError.message)

      const { error } = await supabase.from("planificacion_ejercicios").delete().in("id", deletes)
      if (error) throw new Error(error.message)
    })())
  }

  // 4. Bulk orden — 1 upsert en vez de N updates
  if (orden.length > 0) {
    ops.push((async () => {
      // Necesitamos todas las columnas requeridas para upsert; trae registros mínimos
      const ids = orden.map((o) => o.id)
      const { data: existing, error: fetchError } = await supabase
        .from("planificacion_ejercicios")
        .select("id, planificacion_dia_id, ejercicio_id, categoria, notas_profesor")
        .in("id", ids)
      if (fetchError) throw new Error(fetchError.message)

      const ordenMap = new Map(orden.map((o) => [o.id, o.orden]))
      const upsertRows = (existing ?? []).map((row) => ({
        ...row,
        orden: ordenMap.get(row.id) ?? 0,
      }))

      const { error } = await supabase
        .from("planificacion_ejercicios")
        .upsert(upsertRows, { onConflict: "id" })
      if (error) throw new Error(error.message)
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

  const ids = ejercicios.map((e) => e.id)
  const { data: existing, error: fetchError } = await supabase
    .from("planificacion_ejercicios")
    .select("id, planificacion_dia_id, ejercicio_id, categoria, notas_profesor")
    .in("id", ids)
  if (fetchError) return res.status(500).json({ error: fetchError.message })

  const ordenMap = new Map(ejercicios.map((e) => [e.id, e.orden]))
  const rows = (existing ?? []).map((row) => ({ ...row, orden: ordenMap.get(row.id) ?? 0 }))

  const { error } = await supabase
    .from("planificacion_ejercicios")
    .upsert(rows, { onConflict: "id" })
  if (error) return res.status(500).json({ error: error.message });

  invalidatePlanes()
  res.json({ ok: true });
}

// ─── DOSIS POR SEMANA ─────────────────────────────────────────────────────────

export async function updateDosis(req, res) {
  const { planEjId, semana } = req.params;
  const { dosis, rpe, notas_profesor } = req.body;

  const updatePayload = { dosis, rpe: rpe ?? null };
  if (notas_profesor !== undefined) updatePayload.notas_profesor = notas_profesor;

  const { data, error } = await supabase
    .from("planificacion_semanas")
    .update(updatePayload)
    .eq("planificacion_ejercicio_id", planEjId)
    .eq("semana", semana)
    .select()
    .single();

  if (error) {
    console.error("❌ updateDosis error:", error.message);
    return res.status(500).json({ error: error.message });
  }
  invalidatePlanes()
  res.json(data);
}

// ─── PROGRESO DEL ALUMNO ───────────────────────────────────────────────────────

export async function getProgresoPlanificacion(req, res) {
  const { id } = req.params;
  const planId = Number(id);

  const { data: plan, error: planError } = await supabase
    .from("planificaciones")
    .select("id, alumno_id")
    .eq("id", planId)
    .single();

  if (planError) return res.status(500).json({ error: planError.message });
  if (!plan) return res.status(404).json({ error: "Planificacion no encontrada" });
  if (!plan.alumno_id) {
    return res.json({ sesiones: [], registros: [] });
  }

  const { data: sesiones, error: sesError } = await supabase
    .from("entrenamiento_sesiones")
    .select("*")
    .eq("planificacion_id", planId)
    .eq("alumno_id", plan.alumno_id)
    .order("semana", { ascending: true });

  if (sesError) return res.status(500).json({ error: sesError.message });

  if (!sesiones || sesiones.length === 0) {
    return res.json({ sesiones: [], registros: [] });
  }

  const sesionIds = sesiones.map((s) => s.id);

  const { data: estadosDiarios } = await supabase
    .from("entrenamiento_estado_diario")
    .select("*")
    .in("sesion_id", sesionIds);

  const estadoMap = new Map((estadosDiarios ?? []).map((e) => [e.sesion_id, e]));
  const sesionesConEstado = sesiones.map((s) => {
    const est = estadoMap.get(s.id);
    return {
      ...s,
      durmio_mal: est?.durmio_mal ?? false,
      fatiga: est?.fatiga ?? false,
      desmotivacion: est?.desmotivacion ?? false,
      dolor: est?.dolor ?? false,
    };
  });

  const { data: registros, error: regError } = await supabase
    .from("entrenamiento_registros")
    .select("*")
    .in("sesion_id", sesionIds)
    .order("id", { ascending: true });

  if (regError) return res.status(500).json({ error: regError.message });

  res.json({ sesiones: sesionesConEstado, registros: registros ?? [] });
}

export async function updateDosisBulk(req, res) {
  const { planEjId } = req.params;
  const { semanas } = req.body;

  if (!Array.isArray(semanas)) {
    return res.status(400).json({ error: "semanas debe ser un array" });
  }

  const rows = semanas.map(({ semana, dosis, rpe, notas_profesor }) => ({
    planificacion_ejercicio_id: Number(planEjId),
    semana,
    dosis: dosis ?? null,
    rpe: rpe ?? null,
    notas_profesor: notas_profesor ?? null,
  }))

  const { error } = await supabase
    .from("planificacion_semanas")
    .upsert(rows, { onConflict: "planificacion_ejercicio_id,semana" })

  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes()

  res.json({ ok: true });
}

export async function getAsistenciasPlanificacion(req, res) {
  const planId = Number(req.params.id);
  if (!Number.isFinite(planId)) return res.status(400).json({ error: "planId inválido" });

  const { data: plan, error: planError } = await supabase
    .from("planificaciones")
    .select("id, alumno_id")
    .eq("id", planId)
    .single();

  if (planError) return res.status(500).json({ error: planError.message });
  if (!plan) return res.status(404).json({ error: "Planificacion no encontrada" });
  if (!plan.alumno_id) return res.json({ asistencias: [] });

  const { data: asistencias, error: asisError } = await supabase
    .from("asistencias_alumnos")
    .select("id, fecha, sesion_id, planificacion_id, created_at")
    .eq("alumno_id", plan.alumno_id)
    .order("fecha", { ascending: false });

  if (asisError) return res.status(500).json({ error: asisError.message });
  if (!asistencias || asistencias.length === 0) return res.json({ asistencias: [] });

  const sesionIds = asistencias.map((a) => a.sesion_id).filter(Boolean);
  const idsForQuery = sesionIds.length ? sesionIds : [-1];

  const [{ data: sesiones }, { data: estados }, { data: registros }] = await Promise.all([
    supabase
      .from("entrenamiento_sesiones")
      .select("id, dia_id, semana, estado, fecha_entrenamiento, hoja_id, planificacion_dias(numero_dia, nombre), planificacion_hojas(nombre)")
      .in("id", idsForQuery),
    supabase
      .from("entrenamiento_estado_diario")
      .select("*")
      .in("sesion_id", idsForQuery),
    supabase
      .from("entrenamiento_registros")
      .select("*")
      .in("sesion_id", idsForQuery)
      .order("id", { ascending: true }),
  ]);

  const sesionMap = new Map((sesiones ?? []).map((s) => [s.id, s]));
  const estadoMap = new Map((estados ?? []).map((e) => [e.sesion_id, e]));
  const registrosBySesion = new Map();
  (registros ?? []).forEach((r) => {
    if (!registrosBySesion.has(r.sesion_id)) registrosBySesion.set(r.sesion_id, []);
    registrosBySesion.get(r.sesion_id).push(r);
  });

  const result = asistencias.map((a) => ({
    id: a.id,
    fecha: a.fecha,
    sesion_id: a.sesion_id,
    planificacion_id: a.planificacion_id,
    es_de_este_plan: a.planificacion_id === planId,
    sesion: sesionMap.get(a.sesion_id) ?? null,
    estado_diario: estadoMap.get(a.sesion_id) ?? null,
    registros: registrosBySesion.get(a.sesion_id) ?? [],
  }));

  res.json({ asistencias: result });
}
