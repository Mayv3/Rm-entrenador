import { supabase } from "../lib/supabase.js";
import { cache } from "../lib/cache.js";

// Una serie está "completa" si tiene peso, reps y rpe (mismo criterio que el front).
function serieCompleta(s) {
  return !!(s && s.peso_kg && s.repeticiones && s.rpe);
}

// Un ejercicio quedó "olvidado a medias" si tiene al menos una serie completa
// y al menos una serie sin cargar que NO fue salteada explícitamente.
function registroParcial(series) {
  if (!Array.isArray(series)) return false;
  let algunaCompleta = false;
  let algunaFaltante = false;
  for (const s of series) {
    if (serieCompleta(s)) algunaCompleta = true;
    else if (!s?._saltado) algunaFaltante = true;
  }
  return algunaCompleta && algunaFaltante;
}

// Enriquece un array de sesiones con su estado derivado de los registros:
//  - parcial: algún ejercicio "olvidado a medias".
//  - completados: cantidad de ejercicios resueltos (dato real reps>0 o salteados).
//  - saltado: día completado, con registros, y sin ningún dato real (todo skip).
// Reutilizado por el resumen embebido en el plan y por el detalle por semana.
function enrichSesiones(sesiones, registros) {
  const parcialPorSesion = new Map();
  const resueltosPorSesion = new Map(); // sesion_id -> Set(planificacion_ejercicio_id)
  const conDatoRealPorSesion = new Set();
  const conRegistroPorSesion = new Set();
  for (const r of registros ?? []) {
    conRegistroPorSesion.add(r.sesion_id);
    if (registroParcial(r.series)) parcialPorSesion.set(r.sesion_id, true);
    const tieneReal = Array.isArray(r.series) && r.series.some((s) => Number(s?.repeticiones) > 0);
    if (tieneReal) conDatoRealPorSesion.add(r.sesion_id);
    const resuelto = tieneReal || (Array.isArray(r.series) && r.series.some((s) => s?._saltado === true));
    if (resuelto) {
      if (!resueltosPorSesion.has(r.sesion_id)) resueltosPorSesion.set(r.sesion_id, new Set());
      resueltosPorSesion.get(r.sesion_id).add(r.planificacion_ejercicio_id);
    }
  }
  return (sesiones ?? []).map((s) => ({
    ...s,
    parcial: parcialPorSesion.get(s.id) === true,
    completados: resueltosPorSesion.get(s.id)?.size ?? 0,
    saltado: s.estado === "completado" && conRegistroPorSesion.has(s.id) && !conDatoRealPorSesion.has(s.id),
  }));
}

// Estados de TODAS las sesiones del alumno en el plan (todas las hojas/semanas/días).
// Se embebe en la respuesta del plan para que los cuadrados de semanas y días tengan su
// estado apenas carga la planificación, sin esperar queries extra (ni tras recargar la página).
async function getSesionesEstados(planId, alumnoId) {
  const { data: sesiones, error } = await supabase
    .from("entrenamiento_sesiones")
    .select("id, hoja_id, dia_id, semana, estado")
    .eq("planificacion_id", planId)
    .eq("alumno_id", alumnoId);
  if (error) throw new Error(error.message);
  if (!sesiones || sesiones.length === 0) return [];

  const { data: registros, error: regError } = await supabase
    .from("entrenamiento_registros")
    .select("sesion_id, series, planificacion_ejercicio_id")
    .in("sesion_id", sesiones.map((s) => s.id));
  if (regError) throw new Error(regError.message);

  // Se descarta el id de sesión: el front indexa por hoja_id/semana/dia_id.
  return enrichSesiones(sesiones, registros).map(({ id, ...rest }) => rest);
}

function pickPlan(planificaciones) {
  if (!Array.isArray(planificaciones) || planificaciones.length === 0) return null;
  return (
    planificaciones.find((p) => p.estado === "activo") ||
    planificaciones.find((p) => p.estado === "borrador") ||
    planificaciones[0]
  );
}

async function getPlanificacionCompleta(planId) {
  // Etapa 1: plan y hojas en paralelo (ambos dependen solo de planId).
  const [planRes, hojasRes] = await Promise.all([
    supabase.from("planificaciones").select("*, alumnos(id, nombre)").eq("id", planId).single(),
    supabase.from("planificacion_hojas").select("*").eq("planificacion_id", planId).is("deleted_at", null).order("numero", { ascending: true }),
  ]);

  if (planRes.error) throw new Error(planRes.error.message);
  const plan = planRes.data;
  if (!plan) return null;
  if (hojasRes.error) throw new Error(hojasRes.error.message);
  const hojas = hojasRes.data ?? [];
  if (hojas.length === 0) return { ...plan, hojas: [] };

  const hojaIds = hojas.map((h) => h.id);

  // Etapa 2: días y movilidad en paralelo (ambos dependen de hojaIds).
  const [diasRes, movRes] = await Promise.all([
    supabase.from("planificacion_dias").select("*").in("hoja_id", hojaIds).order("orden", { ascending: true }),
    supabase.from("planificacion_movilidad").select("*").in("hoja_id", hojaIds).order("orden", { ascending: true }),
  ]);
  if (diasRes.error) throw new Error(diasRes.error.message);
  const dias = diasRes.data ?? [];
  const movilidad = movRes.data ?? [];

  // Etapa 3: ejercicios del día (por diaIds) y videos de movilidad (por nombre) en paralelo.
  const diaIds = dias.map((d) => d.id);
  const nombresMov = [...new Set(movilidad.map((m) => m.nombre).filter(Boolean))];
  const [ejerciciosRes, movEjRes] = await Promise.all([
    diaIds.length > 0
      ? supabase.from("planificacion_ejercicios").select("*, ejercicios(id, nombre, grupo_muscular, video_url)").in("planificacion_dia_id", diaIds).order("orden", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    nombresMov.length > 0
      ? supabase.from("ejercicios_movilidad").select("nombre, video_url").in("nombre", nombresMov)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ejerciciosRes.error) throw new Error(ejerciciosRes.error.message);
  const ejercicios = ejerciciosRes.data ?? [];
  const videoByNombre = new Map((movEjRes.data ?? []).map((e) => [e.nombre, e.video_url]));

  // Etapa 4: semanas (dependen de los ids de ejercicios).
  const ejercicioIds = ejercicios.map((e) => e.id);
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
    // Estructura del plan y estados de las sesiones en paralelo: los estados viajan embebidos
    // para pintar los cuadrados sin un segundo request.
    const [planificacion, sesiones] = await Promise.all([
      getPlanificacionCompleta(selectedPlan.id),
      getSesionesEstados(selectedPlan.id, alumnoId),
    ]);
    if (planificacion) planificacion.sesiones = sesiones;
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

// Pesos de la última semana ANTERIOR con datos reales, dentro de la misma hoja y día,
// agrupados por planificacion_ejercicio_id. Salta semanas vacías: si el alumno hizo
// sem1 y saltó a sem3, en sem3 devuelve los pesos de sem1 (última con datos < semana actual).
export async function getPortalSemanaAnteriorPesos(req, res) {
  const planId = Number(req.params.planId);
  const alumnoId = Number(req.query.alumno_id);
  const hojaId = Number(req.query.hoja_id);
  const diaId = Number(req.query.dia_id);
  const semana = Number(req.query.semana); // semana actual

  if (![planId, alumnoId, hojaId, diaId, semana].every(Number.isFinite)) {
    return res.status(400).json({ error: "Faltan o son inválidos: alumno_id, hoja_id, dia_id, semana" });
  }

  const { data: sesiones, error: sErr } = await supabase
    .from("entrenamiento_sesiones")
    .select("id, semana")
    .eq("planificacion_id", planId)
    .eq("alumno_id", alumnoId)
    .eq("hoja_id", hojaId)
    .eq("dia_id", diaId)
    .lt("semana", semana);
  if (sErr) return res.status(500).json({ error: sErr.message });
  if (!sesiones || sesiones.length === 0) return res.json({ registros: {} });

  const semanaBySesion = new Map(sesiones.map((s) => [s.id, s.semana]));
  const sesionIds = sesiones.map((s) => s.id);

  const { data: registros, error: rErr } = await supabase
    .from("entrenamiento_registros")
    .select("*")
    .in("sesion_id", sesionIds);
  if (rErr) return res.status(500).json({ error: rErr.message });

  // Dato real = al menos una serie con reps > 0 (un skip guarda reps 0).
  const tieneData = (r) => {
    if (Array.isArray(r.series) && r.series.length > 0) {
      return r.series.some((s) => Number(s?.repeticiones) > 0);
    }
    return Number(r.repeticiones) > 0;
  };

  // Por planificacion_ejercicio_id: el registro de mayor semana con datos reales.
  const byPlanEj = {};
  for (const r of registros ?? []) {
    if (r.planificacion_ejercicio_id == null || !tieneData(r)) continue;
    const sem = semanaBySesion.get(r.sesion_id) ?? 0;
    const prev = byPlanEj[r.planificacion_ejercicio_id];
    if (!prev || sem > prev._semana || (sem === prev._semana && r.id > prev.id)) {
      byPlanEj[r.planificacion_ejercicio_id] = { ...r, _semana: sem };
    }
  }

  return res.json({ registros: byPlanEj });
}

// Fallback entre planes: último entrenamiento real de cada ejercicio (por ejercicio_id)
// en sesiones de OTROS planes del alumno. Se usa cuando el plan actual todavía no tiene
// datos previos para ese ejercicio (ej: plan nuevo, semana 1) para mantener la progresión.
export async function getPortalUltimoPesoGlobal(req, res) {
  const planId = Number(req.params.planId);
  const alumnoId = Number(req.query.alumno_id);

  if (![planId, alumnoId].every(Number.isFinite)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const { data: sesiones, error: sErr } = await supabase
    .from("entrenamiento_sesiones")
    .select("id, planificacion_id, fecha_entrenamiento, finalizado_at, created_at")
    .eq("alumno_id", alumnoId)
    .neq("planificacion_id", planId);
  if (sErr) return res.status(500).json({ error: sErr.message });
  if (!sesiones || sesiones.length === 0) return res.json({ registros: {} });

  // Clave de orden temporal: día de entrenamiento, luego finalizado/creado.
  const ordKey = (s) => s.fecha_entrenamiento || s.finalizado_at || s.created_at || "";
  const ordBySesion = new Map(sesiones.map((s) => [s.id, ordKey(s)]));
  const sesionIds = sesiones.map((s) => s.id);

  const { data: registros, error: rErr } = await supabase
    .from("entrenamiento_registros")
    .select("*")
    .in("sesion_id", sesionIds);
  if (rErr) return res.status(500).json({ error: rErr.message });

  const tieneData = (r) => {
    if (Array.isArray(r.series) && r.series.length > 0) {
      return r.series.some((s) => Number(s?.repeticiones) > 0);
    }
    return Number(r.repeticiones) > 0;
  };

  // Por ejercicio_id: el registro real más reciente (mayor clave temporal).
  const byEjercicio = {};
  for (const r of registros ?? []) {
    if (r.ejercicio_id == null || !tieneData(r)) continue;
    const ord = ordBySesion.get(r.sesion_id) ?? "";
    const prev = byEjercicio[r.ejercicio_id];
    if (!prev || ord > prev._ord || (ord === prev._ord && r.id > prev.id)) {
      byEjercicio[r.ejercicio_id] = { ...r, _ord: ord };
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

  const sesiones = data ?? [];
  const sesionIds = sesiones.map((s) => s.id);

  let registros = [];
  if (sesionIds.length > 0) {
    const { data: regData, error: regError } = await supabase
      .from("entrenamiento_registros")
      .select("sesion_id, series, planificacion_ejercicio_id")
      .in("sesion_id", sesionIds);
    if (regError) return res.status(500).json({ error: regError.message });
    registros = regData ?? [];
  }

  return res.json({ sesiones: enrichSesiones(sesiones, registros) });
}

// Revertir un día SALTADO: borra la sesión y todo lo colgado (registros, estado diario, asistencia),
// dejando el día como "sin empezar". Guard: solo procede si la sesión no tiene ningún dato real
// (todo skip), para no destruir un entrenamiento cargado por error.
export async function revertirPortalSaltadoDia(req, res) {
  const planId = Number(req.params.planId);
  const alumnoId = Number(req.query.alumno_id);
  const hojaId = Number(req.query.hoja_id);
  const diaId = Number(req.query.dia_id);
  const semana = Number(req.query.semana);

  if (![planId, alumnoId, hojaId, diaId, semana].every(Number.isFinite)) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  const { data: sesion, error: sErr } = await supabase
    .from("entrenamiento_sesiones")
    .select("id")
    .eq("planificacion_id", planId)
    .eq("alumno_id", alumnoId)
    .eq("hoja_id", hojaId)
    .eq("dia_id", diaId)
    .eq("semana", semana)
    .maybeSingle();

  if (sErr) return res.status(500).json({ error: sErr.message });
  if (!sesion) return res.json({ ok: true }); // nada que revertir

  const { data: registros, error: regErr } = await supabase
    .from("entrenamiento_registros")
    .select("series")
    .eq("sesion_id", sesion.id);
  if (regErr) return res.status(500).json({ error: regErr.message });

  const tieneDatoReal = (registros ?? []).some(
    (r) => Array.isArray(r.series) && r.series.some((s) => Number(s?.repeticiones) > 0)
  );
  if (tieneDatoReal) {
    return res.status(409).json({ error: "NO_ES_SALTADO" });
  }

  // Borrar hijos antes que la sesión (FKs RESTRICT).
  await supabase.from("asistencias_alumnos").delete().eq("sesion_id", sesion.id);
  await supabase.from("entrenamiento_estado_diario").delete().eq("sesion_id", sesion.id);
  const { error: delRegErr } = await supabase.from("entrenamiento_registros").delete().eq("sesion_id", sesion.id);
  if (delRegErr) return res.status(500).json({ error: delRegErr.message });
  const { error: delSesErr } = await supabase.from("entrenamiento_sesiones").delete().eq("id", sesion.id);
  if (delSesErr) return res.status(500).json({ error: delSesErr.message });

  return res.json({ ok: true });
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
