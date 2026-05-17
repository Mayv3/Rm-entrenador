import { supabase } from "../lib/supabase.js";
import { cache } from "../lib/cache.js";

const KEYS = {
  plantillas: "plantillas",
  plantilla: (id) => `plantilla:${id}`,
}

function invalidatePlantillas(id) {
  cache.del(KEYS.plantillas)
  if (id) cache.del(KEYS.plantilla(id))
  else cache.delByPrefix("plantilla:")
}

// Build árbol con UNA hoja específica → jsonb data
async function buildDataFromHoja(hojaId) {
  const { data: hoja, error: hError } = await supabase
    .from("planificacion_hojas")
    .select("*")
    .eq("id", hojaId)
    .single()
  if (hError) throw new Error(hError.message)
  if (!hoja) return { hojas: [] }

  const { data: dias } = await supabase
    .from("planificacion_dias")
    .select("*")
    .eq("hoja_id", hojaId)
    .order("orden", { ascending: true })

  const diaIds = (dias ?? []).map((d) => d.id)

  let ejercicios = []
  if (diaIds.length > 0) {
    const { data } = await supabase
      .from("planificacion_ejercicios")
      .select("*")
      .in("planificacion_dia_id", diaIds)
      .order("orden", { ascending: true })
    ejercicios = data ?? []
  }

  const ejIds = ejercicios.map((e) => e.id)

  let semanas = []
  if (ejIds.length > 0) {
    const { data } = await supabase
      .from("planificacion_semanas")
      .select("*")
      .in("planificacion_ejercicio_id", ejIds)
      .order("semana", { ascending: true })
    semanas = data ?? []
  }

  const { data: movilidad } = await supabase
    .from("planificacion_movilidad")
    .select("*")
    .eq("hoja_id", hojaId)
    .order("orden", { ascending: true })

  return {
    hojas: [{
      nombre: hoja.nombre,
      numero: 1,
      movilidad: (movilidad ?? []).map((m) => ({ nombre: m.nombre, imagen_url: m.imagen_url, orden: m.orden })),
      dias: (dias ?? []).map((d) => ({
        numero_dia: d.numero_dia,
        nombre: d.nombre,
        orden: d.orden,
        ejercicios: ejercicios
          .filter((e) => e.planificacion_dia_id === d.id)
          .map((e) => ({
            ejercicio_id: e.ejercicio_id,
            categoria: e.categoria,
            orden: e.orden,
            notas_profesor: e.notas_profesor ?? null,
            semanas: semanas
              .filter((s) => s.planificacion_ejercicio_id === e.id)
              .map((s) => ({ semana: s.semana, dosis: s.dosis, rpe: s.rpe })),
          })),
      })),
    }],
  }
}

// Build árbol completo desde planificaciones tree → jsonb data
async function buildDataFromPlan(planId) {
  const { data: hojas, error: hojasError } = await supabase
    .from("planificacion_hojas")
    .select("*")
    .eq("planificacion_id", planId)
    .order("numero", { ascending: true })
  if (hojasError) throw new Error(hojasError.message)

  if (!hojas || hojas.length === 0) return { hojas: [] }

  const hojaIds = hojas.map((h) => h.id)

  const { data: dias, error: diasError } = await supabase
    .from("planificacion_dias")
    .select("*")
    .in("hoja_id", hojaIds)
    .order("orden", { ascending: true })
  if (diasError) throw new Error(diasError.message)

  const diaIds = (dias ?? []).map((d) => d.id)

  let ejercicios = []
  if (diaIds.length > 0) {
    const { data, error } = await supabase
      .from("planificacion_ejercicios")
      .select("*")
      .in("planificacion_dia_id", diaIds)
      .order("orden", { ascending: true })
    if (error) throw new Error(error.message)
    ejercicios = data ?? []
  }

  const ejIds = ejercicios.map((e) => e.id)

  let semanas = []
  if (ejIds.length > 0) {
    const { data, error } = await supabase
      .from("planificacion_semanas")
      .select("*")
      .in("planificacion_ejercicio_id", ejIds)
      .order("semana", { ascending: true })
    if (error) throw new Error(error.message)
    semanas = data ?? []
  }

  const { data: movilidad } = await supabase
    .from("planificacion_movilidad")
    .select("*")
    .in("hoja_id", hojaIds)
    .order("orden", { ascending: true })

  return {
    hojas: hojas.map((h) => ({
      nombre: h.nombre,
      numero: h.numero,
      movilidad: (movilidad ?? [])
        .filter((m) => m.hoja_id === h.id)
        .map((m) => ({ nombre: m.nombre, imagen_url: m.imagen_url, orden: m.orden })),
      dias: (dias ?? [])
        .filter((d) => d.hoja_id === h.id)
        .map((d) => ({
          numero_dia: d.numero_dia,
          nombre: d.nombre,
          orden: d.orden,
          ejercicios: ejercicios
            .filter((e) => e.planificacion_dia_id === d.id)
            .map((e) => ({
              ejercicio_id: e.ejercicio_id,
              categoria: e.categoria,
              orden: e.orden,
              notas_profesor: e.notas_profesor ?? null,
              semanas: semanas
                .filter((s) => s.planificacion_ejercicio_id === e.id)
                .map((s) => ({ semana: s.semana, dosis: s.dosis, rpe: s.rpe })),
            })),
        })),
    })),
  }
}

// ─── PLANTILLAS ───────────────────────────────────────────────────────────────

export async function getPlantillas(req, res) {
  const cached = cache.get(KEYS.plantillas)
  if (cached) return res.json(cached)

  const { data, error } = await supabase
    .from("planificacion_plantillas")
    .select("id, nombre, descripcion, semanas, created_at")
    .order("created_at", { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  cache.set(KEYS.plantillas, data)
  res.json(data)
}

export async function getPlantillaById(req, res) {
  const { id } = req.params
  const cached = cache.get(KEYS.plantilla(id))
  if (cached) return res.json(cached)

  const { data, error } = await supabase
    .from("planificacion_plantillas")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: "Plantilla no encontrada" })

  cache.set(KEYS.plantilla(id), data)
  res.json(data)
}

// Crea planificación workspace (sin alumno) e inserta árbol completo
async function createWorkspaceFromTree(tree, semanasTotal, nombrePlantilla) {
  const { data: plan, error: planError } = await supabase
    .from("planificaciones")
    .insert([{
      nombre: `[Plantilla] ${nombrePlantilla}`,
      alumno_id: null,
      semanas: semanasTotal,
      estado: "borrador",
    }])
    .select()
    .single()
  if (planError) throw new Error(planError.message)

  const hojas = Array.isArray(tree?.hojas) ? tree.hojas : []

  if (hojas.length === 0) {
    // Insertar Hoja 1 vacía por defecto
    const { data: hoja, error: hError } = await supabase
      .from("planificacion_hojas")
      .insert([{ planificacion_id: plan.id, nombre: "Hoja 1", numero: 1, estado: "activa" }])
      .select()
      .single()
    if (hError) throw new Error(hError.message)
    await supabase.from("planificaciones").update({ hoja_activa_id: hoja.id }).eq("id", plan.id)
    return plan.id
  }

  // Plantilla = 1 hoja max
  const hojaIns = await insertHojaTree(plan.id, hojas[0], semanasTotal, 1, hojas[0].nombre)
  await supabase.from("planificaciones").update({ hoja_activa_id: hojaIns.id }).eq("id", plan.id)
  return plan.id
}

export async function createPlantilla(req, res) {
  const { nombre, descripcion, semanas, data, from_plan_id, from_hoja_id, mode } = req.body

  if (!nombre || typeof nombre !== "string") {
    return res.status(400).json({ error: "nombre es obligatorio" })
  }

  let plantillaData = data ?? { hojas: [] }
  let semanasFinal = semanas ?? 6

  try {
    if (from_hoja_id) {
      plantillaData = await buildDataFromHoja(from_hoja_id)
      if (from_plan_id) {
        const { data: plan } = await supabase
          .from("planificaciones")
          .select("semanas")
          .eq("id", from_plan_id)
          .single()
        semanasFinal = plan?.semanas ?? semanasFinal
      }
    } else if (from_plan_id) {
      // Si no se especifica hoja, tomamos la activa o la primera
      const { data: plan } = await supabase
        .from("planificaciones")
        .select("semanas, hoja_activa_id")
        .eq("id", from_plan_id)
        .single()
      semanasFinal = plan?.semanas ?? semanasFinal

      let targetHojaId = plan?.hoja_activa_id
      if (!targetHojaId) {
        const { data: hojas } = await supabase
          .from("planificacion_hojas")
          .select("id")
          .eq("planificacion_id", from_plan_id)
          .order("numero", { ascending: true })
          .limit(1)
        targetHojaId = hojas?.[0]?.id
      }
      if (targetHojaId) {
        plantillaData = await buildDataFromHoja(targetHojaId)
      }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  // Plantilla SIEMPRE tiene workspace (para poder editar)
  let workspace_plan_id
  try {
    workspace_plan_id = await createWorkspaceFromTree(plantillaData, semanasFinal, nombre.trim())
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  const { data: inserted, error } = await supabase
    .from("planificacion_plantillas")
    .insert([{
      nombre: nombre.trim(),
      descripcion: descripcion ?? null,
      semanas: semanasFinal,
      data: plantillaData,
      workspace_plan_id,
    }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  invalidatePlantillas()
  cache.del("planificaciones")
  res.status(201).json(inserted)
}

// Hidrata workspace para plantilla legacy (sin workspace) usando su jsonb
export async function hidratarPlantilla(req, res) {
  const { id } = req.params

  const { data: plantilla, error: pError } = await supabase
    .from("planificacion_plantillas")
    .select("*")
    .eq("id", id)
    .single()
  if (pError) return res.status(500).json({ error: pError.message })
  if (!plantilla) return res.status(404).json({ error: "Plantilla no encontrada" })
  if (plantilla.workspace_plan_id) {
    return res.json({ workspace_plan_id: plantilla.workspace_plan_id })
  }

  try {
    const workspaceId = await createWorkspaceFromTree(
      plantilla.data ?? { hojas: [] },
      plantilla.semanas ?? 6,
      plantilla.nombre
    )
    await supabase
      .from("planificacion_plantillas")
      .update({ workspace_plan_id: workspaceId })
      .eq("id", id)

    invalidatePlantillas(id)
    cache.del("planificaciones")
    res.json({ workspace_plan_id: workspaceId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function updatePlantilla(req, res) {
  const { id } = req.params
  const { nombre, descripcion, semanas, data } = req.body

  const updates = {}
  if (typeof nombre === "string") updates.nombre = nombre.trim()
  if (descripcion !== undefined) updates.descripcion = descripcion
  if (typeof semanas === "number") updates.semanas = semanas
  if (data !== undefined) updates.data = data

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No hay campos para actualizar" })
  }

  const { data: updated, error } = await supabase
    .from("planificacion_plantillas")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  invalidatePlantillas(id)
  res.json(updated)
}

export async function deletePlantilla(req, res) {
  const { id } = req.params

  const { data: plantilla } = await supabase
    .from("planificacion_plantillas")
    .select("workspace_plan_id")
    .eq("id", id)
    .single()

  const { error } = await supabase
    .from("planificacion_plantillas")
    .delete()
    .eq("id", id)
  if (error) return res.status(500).json({ error: error.message })

  if (plantilla?.workspace_plan_id) {
    await supabase
      .from("planificaciones")
      .delete()
      .eq("id", plantilla.workspace_plan_id)
  }

  invalidatePlantillas(id)
  cache.del("planificaciones")
  cache.delByPrefix("plan:")
  res.json({ ok: true })
}

// Re-serializa workspace plan → plantilla.data jsonb
export async function syncPlantilla(req, res) {
  const { id } = req.params

  const { data: plantilla, error: pError } = await supabase
    .from("planificacion_plantillas")
    .select("workspace_plan_id")
    .eq("id", id)
    .single()
  if (pError) return res.status(500).json({ error: pError.message })
  if (!plantilla?.workspace_plan_id) {
    return res.status(400).json({ error: "Plantilla sin workspace asociado" })
  }

  try {
    const tree = await buildDataFromPlan(plantilla.workspace_plan_id)
    const { error } = await supabase
      .from("planificacion_plantillas")
      .update({ data: tree })
      .eq("id", id)
    if (error) return res.status(500).json({ error: error.message })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  invalidatePlantillas(id)
  res.json({ ok: true })
}

// Inserta una hoja completa (con movilidad/días/ejercicios/semanas) dentro de una planificación
async function insertHojaTree(planificacionId, hojaNode, semanasTotal, numero, nombreOverride) {
  const { data: hojaIns, error: hError } = await supabase
    .from("planificacion_hojas")
    .insert([{
      planificacion_id: planificacionId,
      nombre: nombreOverride ?? hojaNode.nombre,
      numero,
      estado: "activa",
    }])
    .select()
    .single()
  if (hError) throw new Error(hError.message)

  // Movilidad
  const movItems = Array.isArray(hojaNode.movilidad) ? hojaNode.movilidad : []
  if (movItems.length > 0) {
    const movRows = movItems.map((m, i) => ({
      hoja_id: hojaIns.id,
      nombre: m.nombre,
      imagen_url: m.imagen_url ?? null,
      orden: m.orden ?? i,
    }))
    const { error: mError } = await supabase
      .from("planificacion_movilidad")
      .insert(movRows)
    if (mError) throw new Error(mError.message)
  }

  // Días
  const dias = Array.isArray(hojaNode.dias) ? hojaNode.dias : []
  for (const dia of dias) {
    const { data: diaIns, error: dError } = await supabase
      .from("planificacion_dias")
      .insert([{
        hoja_id: hojaIns.id,
        numero_dia: dia.numero_dia,
        nombre: dia.nombre,
        orden: dia.orden,
      }])
      .select()
      .single()
    if (dError) throw new Error(dError.message)

    const ejs = Array.isArray(dia.ejercicios) ? dia.ejercicios : []
    if (ejs.length === 0) continue

    const ejRows = ejs.map((e) => ({
      planificacion_dia_id: diaIns.id,
      ejercicio_id: e.ejercicio_id,
      categoria: e.categoria ?? "A",
      orden: e.orden ?? 0,
      notas_profesor: e.notas_profesor ?? null,
    }))
    const { data: insertedEjs, error: eError } = await supabase
      .from("planificacion_ejercicios")
      .insert(ejRows)
      .select("id")
    if (eError) throw new Error(eError.message)

    const semanasRows = []
    insertedEjs.forEach((ejIns, idx) => {
      const sems = Array.isArray(ejs[idx]?.semanas) ? ejs[idx].semanas : []
      for (let s = 1; s <= semanasTotal; s++) {
        const found = sems.find((sw) => sw.semana === s)
        semanasRows.push({
          planificacion_ejercicio_id: ejIns.id,
          semana: s,
          dosis: found?.dosis ?? null,
          rpe: found?.rpe ?? null,
        })
      }
    })

    if (semanasRows.length > 0) {
      const { error: sError } = await supabase
        .from("planificacion_semanas")
        .insert(semanasRows)
      if (sError) throw new Error(sError.message)
    }
  }

  return hojaIns
}

// ─── ASIGNAR PLANTILLA → AGREGA HOJA AL PLAN DEL ALUMNO ────────────────────────
// Si el alumno ya tiene planificación → agrega la hoja de la plantilla como hoja nueva
// Si no tiene → crea planificación nueva con esa hoja

export async function asignarPlantilla(req, res) {
  const { id } = req.params
  const { alumno_id, nombre } = req.body

  if (!alumno_id) return res.status(400).json({ error: "alumno_id es obligatorio" })

  // 1. Leer plantilla
  const { data: plantilla, error: pError } = await supabase
    .from("planificacion_plantillas")
    .select("*")
    .eq("id", id)
    .single()
  if (pError) return res.status(500).json({ error: pError.message })
  if (!plantilla) return res.status(404).json({ error: "Plantilla no encontrada" })

  // 2. Tree fresh
  let tree
  if (plantilla.workspace_plan_id) {
    try {
      tree = await buildDataFromPlan(plantilla.workspace_plan_id)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  } else {
    tree = plantilla.data ?? { hojas: [] }
  }

  const hojas = Array.isArray(tree.hojas) ? tree.hojas : []
  if (hojas.length === 0) {
    return res.status(400).json({ error: "Plantilla vacía: no tiene hojas" })
  }

  // Plantilla = 1 hoja máximo. Tomamos la primera.
  const hojaPlantilla = hojas[0]
  const semanasTotal = plantilla.semanas ?? 6
  const nombreHoja = plantilla.nombre

  // 3. Buscar plan existente del alumno (no finalizado)
  const { data: existingPlans } = await supabase
    .from("planificaciones")
    .select("id, semanas")
    .eq("alumno_id", alumno_id)
    .neq("estado", "finalizado")
    .order("created_at", { ascending: false })
    .limit(1)

  const existing = existingPlans?.[0]

  try {
    if (existing) {
      // 4a. Append hoja al plan existente
      const { data: maxRow } = await supabase
        .from("planificacion_hojas")
        .select("numero")
        .eq("planificacion_id", existing.id)
        .order("numero", { ascending: false })
        .limit(1)
      const nextNumero = (maxRow?.[0]?.numero ?? 0) + 1

      const hojaIns = await insertHojaTree(existing.id, hojaPlantilla, semanasTotal, nextNumero, nombreHoja)

      cache.del("planificaciones")
      cache.delByPrefix("plan:")

      return res.status(201).json({
        planificacion_id: existing.id,
        hoja_id: hojaIns.id,
        appended: true,
      })
    } else {
      // 4b. Crear plan nuevo + insertar hoja
      let nombreFinal = typeof nombre === "string" ? nombre.trim() : ""
      if (!nombreFinal) {
        const { data: alumno } = await supabase
          .from("alumnos")
          .select("nombre")
          .eq("id", alumno_id)
          .single()
        nombreFinal = `Plan de ${alumno?.nombre ?? "Alumno"}`
      }

      const { data: plan, error: planError } = await supabase
        .from("planificaciones")
        .insert([{
          nombre: nombreFinal,
          alumno_id,
          semanas: semanasTotal,
          estado: "borrador",
        }])
        .select()
        .single()
      if (planError) return res.status(500).json({ error: planError.message })

      const hojaIns = await insertHojaTree(plan.id, hojaPlantilla, semanasTotal, 1, nombreHoja)

      await supabase
        .from("planificaciones")
        .update({ hoja_activa_id: hojaIns.id })
        .eq("id", plan.id)

      cache.del("planificaciones")
      cache.delByPrefix("plan:")

      return res.status(201).json({
        ...plan,
        hoja_activa_id: hojaIns.id,
        planificacion_id: plan.id,
        hoja_id: hojaIns.id,
        appended: false,
      })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
