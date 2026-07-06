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
    .select("*, alumnos(id, nombre), planificacion_hojas!planificacion_id(id, nombre, numero, estado, deleted_at)")
    .order("created_at", { ascending: false });

  if (workspaceIds.length > 0) {
    query = query.not("id", "in", `(${workspaceIds.join(",")})`)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message });
  // Filtrar hojas soft-deleted de cada plan
  const cleaned = (data ?? []).map((p) => ({
    ...p,
    planificacion_hojas: (p.planificacion_hojas ?? []).filter((h) => !h.deleted_at),
  }))

  // Marca necesita_nueva: el alumno completó todos los días de la última semana del
  // bloque activo → terminó el plan, hay que armarle uno nuevo. Se calcula en batch.
  await marcarNecesitaNueva(cleaned)

  cache.set(KEYS.planificaciones, cleaned)
  res.json(cleaned);
}

// Umbrales fijos por semana (no dependen de p.semanas):
//   - semana 4 completa → casi_completo (se pinta verde).
//   - semana 5 completa → necesita_nueva (se separa + titila).
const SEMANA_VERDE = 4
const SEMANA_SEPARA = 5

// Para cada plan (con alumno + hoja activa) marca, según la hoja activa:
//   - necesita_nueva = true → la semana SEMANA_SEPARA tiene todos los días completados.
//   - casi_completo  = true → la semana SEMANA_VERDE tiene todos los días completados (y no la de separar).
// Ambos comparan días completados (estado "completado") contra el total de días de la hoja.
async function marcarNecesitaNueva(planes) {
  // Hoja activa por plan: hoja_activa_id o, en su defecto, la de mayor número.
  const conHoja = []
  for (const p of planes) {
    p.necesita_nueva = false
    p.casi_completo = false
    if (!p.alumno_id) continue
    const hojas = p.planificacion_hojas ?? []
    if (hojas.length === 0) continue
    const hojaActiva =
      hojas.find((h) => h.id === p.hoja_activa_id) ??
      [...hojas].sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0))[0]
    if (!hojaActiva) continue
    conHoja.push({ plan: p, hojaId: hojaActiva.id })
  }
  if (conHoja.length === 0) return

  const hojaIds = [...new Set(conHoja.map((c) => c.hojaId))]
  const planIds = conHoja.map((c) => c.plan.id)

  // Días por hoja activa + sesiones completadas de esas hojas, en paralelo.
  const [{ data: dias }, { data: sesiones }] = await Promise.all([
    supabase.from("planificacion_dias").select("id, hoja_id").in("hoja_id", hojaIds),
    supabase
      .from("entrenamiento_sesiones")
      .select("planificacion_id, hoja_id, dia_id, semana, estado")
      .in("planificacion_id", planIds)
      .eq("estado", "completado"),
  ])

  // Cantidad de días por hoja
  const diasPorHoja = new Map()
  for (const d of dias ?? []) {
    diasPorHoja.set(d.hoja_id, (diasPorHoja.get(d.hoja_id) ?? 0) + 1)
  }

  // Días completados (distintos) por plan en su última semana / hoja activa
  const completadosPorClave = new Map() // `${planId}:${hojaId}:${semana}` -> Set(dia_id)
  for (const s of sesiones ?? []) {
    const key = `${s.planificacion_id}:${s.hoja_id}:${s.semana}`
    if (!completadosPorClave.has(key)) completadosPorClave.set(key, new Set())
    completadosPorClave.get(key).add(s.dia_id)
  }

  for (const { plan, hojaId } of conHoja) {
    const totalDias = diasPorHoja.get(hojaId) ?? 0
    if (totalDias === 0) continue
    const diasDe = (semana) => completadosPorClave.get(`${plan.id}:${hojaId}:${semana}`)?.size ?? 0
    plan.necesita_nueva = diasDe(SEMANA_SEPARA) >= totalDias
    // Semana 4 completa (y aún no terminó la 5) → "casi", se pinta verde.
    plan.casi_completo = !plan.necesita_nueva && diasDe(SEMANA_VERDE) >= totalDias
  }
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
    supabase.from("planificacion_hojas").select("*").eq("planificacion_id", id).is("deleted_at", null).order("numero", { ascending: true }),
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
  try {
    // Soft delete: marca la hoja como eliminada. Preserva días, ejercicios y
    // todo el progreso del alumno (sesiones/registros). Las lecturas filtran deleted_at IS NULL.
    const { data: hoja, error } = await supabase
      .from("planificacion_hojas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", hojaId)
      .is("deleted_at", null)
      .select("id, planificacion_id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Si era la hoja activa, reasignar a la última hoja viva (o null)
    if (hoja) {
      const { data: plan } = await supabase
        .from("planificaciones")
        .select("hoja_activa_id")
        .eq("id", hoja.planificacion_id)
        .single();
      if (plan && plan.hoja_activa_id === Number(hojaId)) {
        const { data: viva } = await supabase
          .from("planificacion_hojas")
          .select("id")
          .eq("planificacion_id", hoja.planificacion_id)
          .is("deleted_at", null)
          .order("numero", { ascending: false })
          .limit(1)
          .maybeSingle();
        await supabase
          .from("planificaciones")
          .update({ hoja_activa_id: viva ? viva.id : null })
          .eq("id", hoja.planificacion_id);
      }
    }

    invalidatePlanes()
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteHoja:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// Papelera: lista las hojas soft-deleted de un plan
export async function listHojasEliminadas(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("planificacion_hojas")
    .select("id, nombre, numero, deleted_at")
    .eq("planificacion_id", id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
}

// Restaura una hoja soft-deleted (deleted_at = null)
export async function restoreHoja(req, res) {
  const { hojaId } = req.params;
  const { data, error } = await supabase
    .from("planificacion_hojas")
    .update({ deleted_at: null })
    .eq("id", hojaId)
    .not("deleted_at", "is", null)
    .select("id, planificacion_id")
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  invalidatePlanes();
  res.json({ ok: true, restored: !!data });
}

// Duplica una hoja completa (días/ejercicios/semanas/movilidad) dentro del mismo plan
export async function duplicateHoja(req, res) {
  const { hojaId } = req.params;
  try {
    // 1. Hoja origen
    const { data: srcHoja, error: hErr } = await supabase
      .from("planificacion_hojas")
      .select("*")
      .eq("id", hojaId)
      .single();
    if (hErr) throw new Error(hErr.message);
    if (!srcHoja) return res.status(404).json({ error: "Hoja no encontrada" });

    const planId = srcHoja.planificacion_id;

    // 2. Días, movilidad y siguiente número en paralelo
    const [diasRes, movRes, maxRes] = await Promise.all([
      supabase.from("planificacion_dias").select("*").eq("hoja_id", hojaId).order("orden", { ascending: true }),
      supabase.from("planificacion_movilidad").select("*").eq("hoja_id", hojaId).order("orden", { ascending: true }),
      supabase.from("planificacion_hojas").select("numero").eq("planificacion_id", planId).is("deleted_at", null).order("numero", { ascending: false }).limit(1),
    ]);
    if (diasRes.error) throw new Error(diasRes.error.message);
    if (movRes.error) throw new Error(movRes.error.message);
    const srcDias = diasRes.data ?? [];
    const srcMov = movRes.data ?? [];
    const nextNumero = (maxRes.data?.[0]?.numero ?? srcHoja.numero ?? 0) + 1;

    // 3. Ejercicios + semanas de todos los días en paralelo
    const diaIds = srcDias.map((d) => d.id);
    let srcEjs = [];
    let srcSemanas = [];
    if (diaIds.length > 0) {
      const { data: ejs, error: eErr } = await supabase
        .from("planificacion_ejercicios")
        .select("*")
        .in("planificacion_dia_id", diaIds);
      if (eErr) throw new Error(eErr.message);
      srcEjs = ejs ?? [];
      const ejIds = srcEjs.map((e) => e.id);
      if (ejIds.length > 0) {
        const { data: sems, error: sErr } = await supabase
          .from("planificacion_semanas")
          .select("*")
          .in("planificacion_ejercicio_id", ejIds);
        if (sErr) throw new Error(sErr.message);
        srcSemanas = sems ?? [];
      }
    }

    // 4. Crear hoja nueva
    const { data: newHoja, error: nhErr } = await supabase
      .from("planificacion_hojas")
      .insert([{
        planificacion_id: planId,
        nombre: `${srcHoja.nombre} (copia)`,
        numero: nextNumero,
        estado: "activa",
      }])
      .select()
      .single();
    if (nhErr) throw new Error(nhErr.message);

    // 5. Movilidad (paralela con días)
    const movPromise = srcMov.length === 0
      ? Promise.resolve({ error: null })
      : supabase.from("planificacion_movilidad").insert(
          srcMov.map((m) => ({ hoja_id: newHoja.id, nombre: m.nombre, imagen_url: m.imagen_url ?? null, orden: m.orden }))
        );

    if (srcDias.length === 0) {
      const { error } = await movPromise;
      if (error) throw new Error(error.message);
      invalidatePlanes(planId);
      return res.status(201).json(newHoja);
    }

    // 6. Bulk insert días (preserva orden → mapeable por índice)
    const { data: newDias, error: ndErr } = await supabase
      .from("planificacion_dias")
      .insert(srcDias.map((d) => ({ hoja_id: newHoja.id, numero_dia: d.numero_dia, nombre: d.nombre, orden: d.orden })))
      .select("id");
    if (ndErr) throw new Error(ndErr.message);
    const diaIdMap = new Map(srcDias.map((d, i) => [d.id, newDias[i].id]));

    // 7. Bulk insert ejercicios
    if (srcEjs.length === 0) {
      const { error } = await movPromise;
      if (error) throw new Error(error.message);
      invalidatePlanes(planId);
      return res.status(201).json(newHoja);
    }
    const { data: newEjs, error: neErr } = await supabase
      .from("planificacion_ejercicios")
      .insert(srcEjs.map((e) => ({
        planificacion_dia_id: diaIdMap.get(e.planificacion_dia_id),
        ejercicio_id: e.ejercicio_id,
        categoria: e.categoria,
        orden: e.orden,
        series: e.series,
        notas_profesor: e.notas_profesor ?? null,
      })))
      .select("id");
    if (neErr) throw new Error(neErr.message);
    const ejIdMap = new Map(srcEjs.map((e, i) => [e.id, newEjs[i].id]));

    // 8. Bulk insert semanas
    const semanasPromise = srcSemanas.length === 0
      ? Promise.resolve({ error: null })
      : supabase.from("planificacion_semanas").insert(
          srcSemanas.map((s) => ({
            planificacion_ejercicio_id: ejIdMap.get(s.planificacion_ejercicio_id),
            semana: s.semana,
            dosis: s.dosis ?? null,
            rpe: s.rpe ?? null,
            notas_profesor: s.notas_profesor ?? null,
          }))
        );

    const [movFinal, semFinal] = await Promise.all([movPromise, semanasPromise]);
    if (movFinal?.error) throw new Error(movFinal.error.message);
    if (semFinal?.error) throw new Error(semFinal.error.message);

    invalidatePlanes(planId);
    res.status(201).json(newHoja);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

  // Limpiar sesiones huérfanas (sin dato real) que bloquean el borrado del día.
  // FK entrenamiento_sesiones_dia_id_fkey es RESTRICT: no se puede borrar el día
  // mientras existan sesiones apuntándolo.
  const { data: sesiones, error: sesionesError } = await supabase
    .from("entrenamiento_sesiones")
    .select("id")
    .eq("dia_id", diaId);
  if (sesionesError) return res.status(500).json({ error: sesionesError.message });

  const sesionIds = (sesiones ?? []).map((s) => s.id);
  if (sesionIds.length > 0) {
    // Dato real = algún registro con repeticiones > 0.
    const { data: regsReales, error: regsError } = await supabase
      .from("entrenamiento_registros")
      .select("sesion_id")
      .in("sesion_id", sesionIds)
      .gt("repeticiones", 0);
    if (regsError) return res.status(500).json({ error: regsError.message });

    const sesionesConDato = new Set((regsReales ?? []).map((r) => r.sesion_id));
    if (sesionesConDato.size > 0) {
      return res.status(409).json({
        error:
          "No se puede eliminar el día: tiene sesiones de entrenamiento con datos reales cargados por el alumno.",
      });
    }

    // Todas las sesiones son huérfanas (sin reps). Borrar registros + sesiones.
    const { error: delRegsError } = await supabase
      .from("entrenamiento_registros")
      .delete()
      .in("sesion_id", sesionIds);
    if (delRegsError) return res.status(500).json({ error: delRegsError.message });

    const { error: delSesError } = await supabase
      .from("entrenamiento_sesiones")
      .delete()
      .in("id", sesionIds);
    if (delSesError) return res.status(500).json({ error: delSesError.message });
  }

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

export async function duplicateDia(req, res) {
  const { diaId } = req.params;
  try {
    // 1. Día origen
    const { data: srcDia, error: dErr } = await supabase
      .from("planificacion_dias")
      .select("*")
      .eq("id", diaId)
      .single();
    if (dErr) throw new Error(dErr.message);
    if (!srcDia) return res.status(404).json({ error: "Día no encontrado" });

    // 2. Ejercicios + semanas del día
    const { data: srcEjs, error: eErr } = await supabase
      .from("planificacion_ejercicios")
      .select("*")
      .eq("planificacion_dia_id", diaId);
    if (eErr) throw new Error(eErr.message);
    const ejIds = (srcEjs ?? []).map((e) => e.id);

    let srcSemanas = [];
    if (ejIds.length > 0) {
      const { data: sems, error: sErr } = await supabase
        .from("planificacion_semanas")
        .select("*")
        .in("planificacion_ejercicio_id", ejIds);
      if (sErr) throw new Error(sErr.message);
      srcSemanas = sems ?? [];
    }

    // 3. Siguiente numero_dia y orden en la hoja
    const { data: diasHoja, error: dhErr } = await supabase
      .from("planificacion_dias")
      .select("numero_dia, orden")
      .eq("hoja_id", srcDia.hoja_id)
      .order("orden", { ascending: false })
      .limit(1);
    if (dhErr) throw new Error(dhErr.message);
    const maxOrden = diasHoja?.[0]?.orden ?? srcDia.orden;
    const maxNumero = diasHoja?.[0]?.numero_dia ?? srcDia.numero_dia;

    // 4. Crear día nuevo
    const { data: newDia, error: ndErr } = await supabase
      .from("planificacion_dias")
      .insert([{
        hoja_id: srcDia.hoja_id,
        numero_dia: maxNumero + 1,
        nombre: `${srcDia.nombre} (copia)`,
        orden: maxOrden + 1,
      }])
      .select()
      .single();
    if (ndErr) throw new Error(ndErr.message);

    if (srcEjs.length === 0) {
      invalidatePlanes();
      return res.status(201).json(newDia);
    }

    // 5. Bulk insert ejercicios
    const { data: newEjs, error: neErr } = await supabase
      .from("planificacion_ejercicios")
      .insert(srcEjs.map((e) => ({
        planificacion_dia_id: newDia.id,
        ejercicio_id: e.ejercicio_id,
        categoria: e.categoria,
        orden: e.orden,
        series: e.series,
        notas_profesor: e.notas_profesor ?? null,
      })))
      .select("id");
    if (neErr) throw new Error(neErr.message);
    const ejIdMap = new Map(srcEjs.map((e, i) => [e.id, newEjs[i].id]));

    // 6. Bulk insert semanas
    if (srcSemanas.length > 0) {
      const { error: nsErr } = await supabase
        .from("planificacion_semanas")
        .insert(srcSemanas.map((s) => ({
          planificacion_ejercicio_id: ejIdMap.get(s.planificacion_ejercicio_id),
          semana: s.semana,
          dosis: s.dosis ?? null,
          rpe: s.rpe ?? null,
          notas_profesor: s.notas_profesor ?? null,
        })));
      if (nsErr) throw new Error(nsErr.message);
    }

    invalidatePlanes();
    res.status(201).json(newDia);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// ─── SALTAR EJERCICIO (profesor, desde panel de progreso) ────────────────────────
// Marca un ejercicio como "saltado" en nombre del alumno: crea la sesión si no existe
// y upsertea UN registro con series _saltado (sin tocar el resto de la sesión).
export async function saltarEjercicioProgreso(req, res) {
  const planId = Number(req.params.id);
  const { alumno_id, hoja_id, dia_id, semana, planificacion_ejercicio_id } = req.body;
  const a = Number(alumno_id), h = Number(hoja_id), d = Number(dia_id), s = Number(semana), pe = Number(planificacion_ejercicio_id);
  if (![planId, a, h, d, s, pe].every(Number.isFinite)) {
    return res.status(400).json({ error: "Parámetros inválidos: alumno_id, hoja_id, dia_id, semana, planificacion_ejercicio_id" });
  }

  // 1. Validar pertenencia del ejercicio al día + traer snapshots.
  const { data: ej, error: ejErr } = await supabase
    .from("planificacion_ejercicios")
    .select("id, ejercicio_id, categoria, planificacion_dia_id, ejercicios(nombre)")
    .eq("id", pe)
    .single();
  if (ejErr) return res.status(500).json({ error: ejErr.message });
  if (!ej || ej.planificacion_dia_id !== d) {
    return res.status(400).json({ error: "El ejercicio no pertenece al día indicado" });
  }

  // 2. Buscar sesión existente o crearla (no toca el estado si ya existe).
  let sesionId;
  const { data: ses, error: sesErr } = await supabase
    .from("entrenamiento_sesiones")
    .select("id")
    .eq("alumno_id", a).eq("planificacion_id", planId).eq("hoja_id", h).eq("dia_id", d).eq("semana", s)
    .maybeSingle();
  if (sesErr) return res.status(500).json({ error: sesErr.message });
  if (ses) {
    sesionId = ses.id;
  } else {
    const { data: nueva, error: insErr } = await supabase
      .from("entrenamiento_sesiones")
      .insert({ alumno_id: a, planificacion_id: planId, hoja_id: h, dia_id: d, semana: s, estado: "abierta" })
      .select("id").single();
    if (insErr) return res.status(500).json({ error: insErr.message });
    sesionId = nueva.id;
  }

  // 3. Upsert del registro saltado (conflict por sesión+ejercicio → no pisa otros registros).
  const { error: regErr } = await supabase
    .from("entrenamiento_registros")
    .upsert({
      sesion_id: sesionId,
      planificacion_ejercicio_id: pe,
      ejercicio_id: ej.ejercicio_id,
      peso_kg: 0,
      repeticiones: 0,
      rpe: 0,
      series: [{ peso_kg: 0, repeticiones: 0, rpe: 0, _saltado: true }],
      ejercicio_nombre_snapshot: ej.ejercicios?.nombre ?? "Ejercicio",
      categoria_snapshot: ej.categoria ?? null,
    }, { onConflict: "sesion_id,planificacion_ejercicio_id" });
  if (regErr) return res.status(500).json({ error: regErr.message });

  invalidatePlanes(planId);
  cache.del("planificaciones");
  res.json({ ok: true, sesion_id: sesionId });
}

// Deshace el salto: borra el registro _saltado para volver la celda a "pendiente".
export async function deshacerSaltoProgreso(req, res) {
  const planId = Number(req.params.id);
  const { sesion_id, planificacion_ejercicio_id } = req.body;
  const ses = Number(sesion_id), pe = Number(planificacion_ejercicio_id);
  if (![ses, pe].every(Number.isFinite)) {
    return res.status(400).json({ error: "Parámetros inválidos: sesion_id, planificacion_ejercicio_id" });
  }

  const { error } = await supabase
    .from("entrenamiento_registros")
    .delete()
    .eq("sesion_id", ses)
    .eq("planificacion_ejercicio_id", pe);
  if (error) return res.status(500).json({ error: error.message });

  invalidatePlanes(planId);
  cache.del("planificaciones");
  res.json({ ok: true });
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

// Entrenamientos de un día dado (default hoy) entre TODOS los alumnos, con el detalle
// de lo que hizo cada uno (registros + estado diario). Para el apartado "Hoy" del dashboard.
// El front manda ?fecha=YYYY-MM-DD calculada en su zona horaria (el server puede estar en UTC).
export async function getEntrenamientosDia(req, res) {
  const fecha = typeof req.query.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha)
    ? req.query.fecha
    : new Date().toISOString().slice(0, 10);

  const { data: asistencias, error: asisError } = await supabase
    .from("asistencias_alumnos")
    .select("id, fecha, alumno_id, sesion_id, planificacion_id, created_at, alumnos(id, nombre)")
    .eq("fecha", fecha)
    .order("created_at", { ascending: false });

  if (asisError) return res.status(500).json({ error: asisError.message });
  if (!asistencias || asistencias.length === 0) return res.json({ fecha, entrenamientos: [] });

  const sesionIds = asistencias.map((a) => a.sesion_id).filter(Boolean);
  const idsForQuery = sesionIds.length ? sesionIds : [-1];

  const [{ data: sesiones }, { data: estados }, { data: registros }] = await Promise.all([
    supabase
      .from("entrenamiento_sesiones")
      .select("id, dia_id, semana, estado, hoja_id, planificacion_dias(numero_dia, nombre), planificacion_hojas(nombre)")
      .in("id", idsForQuery),
    supabase
      .from("entrenamiento_estado_diario")
      .select("*")
      .in("sesion_id", idsForQuery),
    supabase
      .from("entrenamiento_registros")
      .select("id, sesion_id, planificacion_ejercicio_id, series, notas, ejercicio_nombre_snapshot, categoria_snapshot, prescripcion_dosis, prescripcion_rpe")
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

  // Una sesión cuenta como entreno "real" si tiene alguna serie NO salteada con repeticiones > 0.
  // (Peso corporal cuenta: reps > 0 aunque peso sea 0. Un skip lleva _saltado=true y series en 0,
  // y una serie vacía va con reps null/0 — ninguno cuenta.)
  // Ocultamos las sesiones solo-skip / vacías: en "Hoy" solo se ven entrenos reales.
  const tieneDatosReales = (regs) =>
    (regs ?? []).some((r) =>
      (r.series ?? []).some((s) => s && s._saltado !== true && Number(s.repeticiones) > 0)
    );

  const entrenamientos = asistencias
    .map((a) => ({
      asistencia_id: a.id,
      fecha: a.fecha,
      hora: a.created_at,
      alumno: a.alumnos ?? { id: a.alumno_id, nombre: "Alumno" },
      sesion_id: a.sesion_id,
      sesion: sesionMap.get(a.sesion_id) ?? null,
      estado_diario: estadoMap.get(a.sesion_id) ?? null,
      registros: registrosBySesion.get(a.sesion_id) ?? [],
    }))
    .filter((e) => tieneDatosReales(e.registros));

  res.json({ fecha, entrenamientos });
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
