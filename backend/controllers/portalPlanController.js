import { supabase } from "../lib/supabase.js";
import { cache } from "../lib/cache.js";

function pickPlan(planificaciones) {
  if (!Array.isArray(planificaciones) || planificaciones.length === 0) return null;
  return (
    planificaciones.find((p) => p.estado === "activo") ||
    planificaciones.find((p) => p.estado === "borrador") ||
    planificaciones[0]
  );
}

async function getPlanificacionCompleta(planId) {
  const { data: plan, error: planError } = await supabase
    .from("planificaciones")
    .select("*, alumnos(id, nombre)")
    .eq("id", planId)
    .single();

  if (planError) throw new Error(planError.message);
  if (!plan) return null;

  const { data: hojas, error: hojasError } = await supabase
    .from("planificacion_hojas")
    .select("*")
    .eq("planificacion_id", planId)
    .is("deleted_at", null)
    .order("numero", { ascending: true });

  if (hojasError) throw new Error(hojasError.message);
  if (!hojas || hojas.length === 0) return { ...plan, hojas: [] };

  const hojaIds = hojas.map((h) => h.id);

  const { data: dias, error: diasError } = await supabase
    .from("planificacion_dias")
    .select("*")
    .in("hoja_id", hojaIds)
    .order("orden", { ascending: true });

  if (diasError) throw new Error(diasError.message);
  if (!dias || dias.length === 0) {
    return { ...plan, hojas: hojas.map((h) => ({ ...h, dias: [] })) };
  }

  const diaIds = dias.map((d) => d.id);

  const { data: ejercicios, error: ejerciciosError } = await supabase
    .from("planificacion_ejercicios")
    .select("*, ejercicios(id, nombre, grupo_muscular, video_url)")
    .in("planificacion_dia_id", diaIds)
    .order("orden", { ascending: true });

  if (ejerciciosError) throw new Error(ejerciciosError.message);

  const ejercicioIds = (ejercicios ?? []).map((e) => e.id);
  let semanas = [];

  if (ejercicioIds.length > 0) {
    const { data: semanasData, error: semanasError } = await supabase
      .from("planificacion_semanas")
      .select("*")
      .in("planificacion_ejercicio_id", ejercicioIds)
      .order("semana", { ascending: true });

    if (semanasError) throw new Error(semanasError.message);
    semanas = semanasData ?? [];
  }

  const { data: movilidadData } = await supabase
    .from("planificacion_movilidad")
    .select("*")
    .in("hoja_id", hojaIds)
    .order("orden", { ascending: true });

  const movilidad = movilidadData ?? [];

  let videoByNombre = new Map();
  if (movilidad.length > 0) {
    const nombres = [...new Set(movilidad.map((m) => m.nombre).filter(Boolean))];
    if (nombres.length > 0) {
      const { data: movEj } = await supabase
        .from("ejercicios_movilidad")
        .select("nombre, video_url")
        .in("nombre", nombres);
      videoByNombre = new Map((movEj ?? []).map((e) => [e.nombre, e.video_url]));
    }
  }

  const hojasCompletas = hojas.map((hoja) => ({
    ...hoja,
    movilidad: movilidad
      .filter((m) => m.hoja_id === hoja.id)
      .map((m) => ({ ...m, video_url: videoByNombre.get(m.nombre) ?? null })),
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

  return { ...plan, hojas: hojasCompletas };
}

export async function getPortalPlanificacion(req, res) {
  const alumnoId = Number(req.params.alumnoId);
  if (!Number.isFinite(alumnoId)) {
    return res.status(400).json({ error: "alumnoId inválido" });
  }

  const { data: planes, error: planesError } = await supabase
    .from("planificaciones")
    .select("id, estado, created_at")
    .eq("alumno_id", alumnoId)
    .order("created_at", { ascending: false });

  if (planesError) return res.status(500).json({ error: planesError.message });

  const selectedPlan = pickPlan(planes ?? []);
  if (!selectedPlan) {
    return res.json({ planificacion: null });
  }

  try {
    const planificacion = await getPlanificacionCompleta(selectedPlan.id);
    return res.json({ planificacion });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function getPortalSesion(req, res) {
  const planId = Number(req.params.planId);
  const alumnoId = Number(req.query.alumno_id);
  const hojaId = Number(req.query.hoja_id);
  const diaId = Number(req.query.dia_id);
  const semana = Number(req.query.semana);

  if (![planId, alumnoId, hojaId, diaId, semana].every(Number.isFinite)) {
    return res.status(400).json({ error: "Faltan o son inválidos: alumno_id, hoja_id, dia_id, semana" });
  }

  const { data: sesion, error: sesionError } = await supabase
    .from("entrenamiento_sesiones")
    .select("*")
    .eq("alumno_id", alumnoId)
    .eq("planificacion_id", planId)
    .eq("hoja_id", hojaId)
    .eq("dia_id", diaId)
    .eq("semana", semana)
    .maybeSingle();

  if (sesionError) return res.status(500).json({ error: sesionError.message });

  if (!sesion) {
    return res.json({ sesion: null, estado_diario: null, registros: [] });
  }

  let estadoDiario = null;
  const { data: estadoData, error: estadoError } = await supabase
    .from("entrenamiento_estado_diario")
    .select("*")
    .eq("sesion_id", sesion.id)
    .maybeSingle();

  if (estadoError) console.error("[DB] Error fetching estado_diario:", estadoError.message)
  else estadoDiario = estadoData;

  const { data: registros, error: registrosError } = await supabase
    .from("entrenamiento_registros")
    .select("*")
    .eq("sesion_id", sesion.id)
    .order("id", { ascending: true });

  if (registrosError) return res.status(500).json({ error: registrosError.message });

  return res.json({ sesion, estado_diario: estadoDiario, registros: registros ?? [] });
}

// Pesos de la última semana entrenada de la hoja anterior, agrupados por ejercicio_id.
// Se usa en semana 1 del bloque actual para mostrar la referencia del bloque previo.
export async function getPortalHojaAnteriorPesos(req, res) {
  const planId = Number(req.params.planId);
  const alumnoId = Number(req.query.alumno_id);
  const hojaId = Number(req.query.hoja_id); // hoja anterior

  if (![planId, alumnoId, hojaId].every(Number.isFinite)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const { data: sesiones, error: sErr } = await supabase
    .from("entrenamiento_sesiones")
    .select("id, semana")
    .eq("planificacion_id", planId)
    .eq("alumno_id", alumnoId)
    .eq("hoja_id", hojaId);
  if (sErr) return res.status(500).json({ error: sErr.message });
  if (!sesiones || sesiones.length === 0) return res.json({ registros: {} });

  const semanaBySesion = new Map(sesiones.map((s) => [s.id, s.semana]));
  const sesionIds = sesiones.map((s) => s.id);

  const { data: registros, error: rErr } = await supabase
    .from("entrenamiento_registros")
    .select("*")
    .in("sesion_id", sesionIds);
  if (rErr) return res.status(500).json({ error: rErr.message });

  const tieneData = (r) => {
    if (Array.isArray(r.series) && r.series.length > 0) {
      return r.series.some((s) => Number(s?.peso_kg) > 0 || Number(s?.repeticiones) > 0);
    }
    return Number(r.peso_kg) > 0 || Number(r.repeticiones) > 0;
  };

  // Por ejercicio_id: el registro de mayor semana con datos reales (última vez entrenado en la hoja anterior)
  const byEjercicio = {};
  for (const r of registros ?? []) {
    if (r.ejercicio_id == null || !tieneData(r)) continue;
    const sem = semanaBySesion.get(r.sesion_id) ?? 0;
    const prev = byEjercicio[r.ejercicio_id];
    if (!prev || sem > prev._semana || (sem === prev._semana && r.id > prev.id)) {
      byEjercicio[r.ejercicio_id] = { ...r, _semana: sem };
    }
  }

  return res.json({ registros: byEjercicio });
}

export async function getPortalSesionesResumen(req, res) {
  const planId = Number(req.params.planId);
  const alumnoId = Number(req.query.alumno_id);
  const hojaId = Number(req.query.hoja_id);

  if (![planId, alumnoId, hojaId].every(Number.isFinite)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const { data, error } = await supabase
    .from("entrenamiento_sesiones")
    .select("semana, dia_id, estado")
    .eq("planificacion_id", planId)
    .eq("alumno_id", alumnoId)
    .eq("hoja_id", hojaId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ sesiones: data ?? [] });
}

export async function getPortalSesionesSemana(req, res) {
  const planId = Number(req.params.planId);
  const alumnoId = Number(req.query.alumno_id);
  const hojaId = Number(req.query.hoja_id);
  const semana = Number(req.query.semana);

  if (![planId, alumnoId, hojaId, semana].every(Number.isFinite)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const { data, error } = await supabase
    .from("entrenamiento_sesiones")
    .select("id, dia_id, estado")
    .eq("planificacion_id", planId)
    .eq("alumno_id", alumnoId)
    .eq("hoja_id", hojaId)
    .eq("semana", semana);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ sesiones: data ?? [] });
}

export async function upsertPortalSesion(req, res) {
  const planId = Number(req.params.planId);
  const {
    alumno_id,
    hoja_id,
    dia_id,
    semana,
    estado,
    fecha_entrenamiento,
    registros = [],
    durmio_mal,
    fatiga,
    desmotivacion,
    dolor,
    excelente,
    client_rev,
  } = req.body;

  const alumnoId = Number(alumno_id);
  const hojaId = Number(hoja_id);
  const diaId = Number(dia_id);
  const semanaNum = Number(semana);

  if (![planId, alumnoId, hojaId, diaId, semanaNum].every(Number.isFinite)) {
    return res.status(400).json({ error: "Faltan o son inválidos: alumno_id, hoja_id, dia_id, semana" });
  }

  // Todo el guardado va en UNA función transaccional (guardar_sesion_portal): valida pertenencia,
  // upsertea sesión + estado_diario + asistencia + registros y deriva los snapshots, todo o nada.
  // Elimina las escrituras parciales y colapsa ~6 round-trips a 1.
  const payload = {
    alumno_id: alumnoId,
    planificacion_id: planId,
    hoja_id: hojaId,
    dia_id: diaId,
    semana: semanaNum,
    estado: estado ?? "abierta",
    fecha_entrenamiento: fecha_entrenamiento ?? null,
    client_rev: Number.isFinite(Number(client_rev)) ? Number(client_rev) : 0,
    registros: Array.isArray(registros) ? registros : [],
  };

  // El check-in (estado de salud) solo se persiste si el frontend envió alguno de sus campos.
  const hasEstadoDiario =
    durmio_mal !== undefined || fatiga !== undefined || desmotivacion !== undefined || dolor !== undefined || excelente !== undefined;
  if (hasEstadoDiario) {
    payload.estado_diario = {
      durmio_mal: !!durmio_mal,
      fatiga: !!fatiga,
      desmotivacion: !!desmotivacion,
      dolor: !!dolor,
      excelente: !!excelente,
    };
  }

  const { data, error } = await supabase.rpc("guardar_sesion_portal", { p: payload });

  if (error) {
    if (error.message && error.message.includes("EJERCICIO_NO_PERTENECE")) {
      return res.status(400).json({ error: "Un ejercicio no pertenece al día indicado" });
    }
    return res.status(500).json({ error: error.message });
  }

  // El estado de las sesiones cambió → la lista del entrenador (que deriva necesita_nueva
  // de las sesiones completadas) quedó desactualizada. Invalidar su cache.
  cache.del("planificaciones");

  return res.json(data);
}
