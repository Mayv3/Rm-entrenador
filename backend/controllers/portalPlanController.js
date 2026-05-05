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
    return res.json({ sesion: null, registros: [] });
  }

  const { data: registros, error: registrosError } = await supabase
    .from("entrenamiento_registros")
    .select("*")
    .eq("sesion_id", sesion.id)
    .order("id", { ascending: true });

  if (registrosError) return res.status(500).json({ error: registrosError.message });

  return res.json({ sesion, registros: registros ?? [] });
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
  } = req.body;

  const alumnoId = Number(alumno_id);
  const hojaId = Number(hoja_id);
  const diaId = Number(dia_id);
  const semanaNum = Number(semana);

  if (![planId, alumnoId, hojaId, diaId, semanaNum].every(Number.isFinite)) {
    return res.status(400).json({ error: "Faltan o son inválidos: alumno_id, hoja_id, dia_id, semana" });
  }

  const cacheKey = `ej_dia:${diaId}`;
  let ejerciciosDia = cache.get(cacheKey);

  if (!ejerciciosDia) {
    const { data, error: ejerciciosError } = await supabase
      .from("planificacion_ejercicios")
      .select("id, categoria, ejercicio_id, ejercicios(id, nombre), planificacion_semanas(semana, dosis, rpe)")
      .eq("planificacion_dia_id", diaId);

    if (ejerciciosError) return res.status(500).json({ error: ejerciciosError.message });
    ejerciciosDia = data;
    cache.set(cacheKey, ejerciciosDia);
  }

  const ejercicioMap = new Map((ejerciciosDia ?? []).map((e) => [Number(e.id), e]));

  for (const reg of registros) {
    const planEjId = Number(reg.planificacion_ejercicio_id);
    if (!ejercicioMap.has(planEjId)) {
      return res.status(400).json({
        error: `El ejercicio ${planEjId} no pertenece al día ${diaId}`,
      });
    }
  }

  const { data: sesion, error: sesionError } = await supabase
    .from("entrenamiento_sesiones")
    .upsert(
      {
        alumno_id: alumnoId,
        planificacion_id: planId,
        hoja_id: hojaId,
        dia_id: diaId,
        semana: semanaNum,
        estado: estado ?? "abierta",
        fecha_entrenamiento: fecha_entrenamiento ?? null,
      },
      { onConflict: "alumno_id,planificacion_id,hoja_id,dia_id,semana" }
    )
    .select("*")
    .single();

  if (sesionError) return res.status(500).json({ error: sesionError.message });

  if (registros.length > 0) {
    const rows = registros.map((reg) => {
      const planEjId = Number(reg.planificacion_ejercicio_id);
      const planEj = ejercicioMap.get(planEjId);
      const prescripcionSemana = (planEj.planificacion_semanas ?? []).find(
        (s) => Number(s.semana) === semanaNum
      );

      const seriesArr = Array.isArray(reg.series) ? reg.series : [];
      const s0 = seriesArr[0] ?? {};
      const toNum = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

      return {
        sesion_id: sesion.id,
        planificacion_ejercicio_id: planEjId,
        ejercicio_id: Number(planEj.ejercicio_id),
        peso_kg: toNum(s0.peso_kg ?? reg.peso_kg),
        repeticiones: toNum(s0.repeticiones ?? reg.repeticiones),
        rpe: toNum(s0.rpe ?? reg.rpe),
        notas: reg.notas?.trim() ? reg.notas.trim() : null,
        series: seriesArr,
        ejercicio_nombre_snapshot: planEj.ejercicios?.nombre ?? "Ejercicio",
        categoria_snapshot: planEj.categoria ?? null,
        prescripcion_dosis: prescripcionSemana?.dosis ?? null,
        prescripcion_rpe: prescripcionSemana?.rpe ?? null,
      };
    });

    const { error: upsertRegistrosError } = await supabase
      .from("entrenamiento_registros")
      .upsert(rows, { onConflict: "sesion_id,planificacion_ejercicio_id" });

    if (upsertRegistrosError) {
      return res.status(500).json({ error: upsertRegistrosError.message });
    }
  }

  const { data: registrosGuardados, error: registrosError } = await supabase
    .from("entrenamiento_registros")
    .select("*")
    .eq("sesion_id", sesion.id)
    .order("id", { ascending: true });

  if (registrosError) return res.status(500).json({ error: registrosError.message });

  return res.json({ sesion, registros: registrosGuardados ?? [] });
}
