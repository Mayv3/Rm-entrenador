import { Page, Route } from "@playwright/test"

export const STUDENT_ID = 1
export const PLAN_ID = 100
export const HOJA_ID = 200
export const DIA_1_ID = 301
export const DIA_2_ID = 302
export const EJ_1_ID = 401
export const EJ_2_ID = 402
export const EJ_3_ID = 403

export interface PlanState {
  registros: Map<string, any>
  estado: Map<string, any>
}

export function makePlanFixture(opts: { extraEjercicios?: number } = {}) {
  const planificacion = {
    id: PLAN_ID,
    nombre: "Plan Test",
    semanas: 4,
    hoja_activa_id: HOJA_ID,
    hojas: [
      {
        id: HOJA_ID,
        nombre: "Hoja 1",
        numero: 1,
        estado: "activa",
        movilidad: [],
        dias: [
          {
            id: DIA_1_ID,
            hoja_id: HOJA_ID,
            numero_dia: 1,
            nombre: "Torso",
            orden: 1,
            ejercicios: [
              {
                id: EJ_1_ID,
                planificacion_dia_id: DIA_1_ID,
                ejercicio_id: 901,
                categoria: "A",
                orden: 1,
                ejercicios: { id: 901, nombre: "Press plano barra", grupo_muscular: "Pecho", video_url: "https://youtu.be/test" },
                semanas: [
                  { semana: 1, dosis: "3 x 6-4", rpe: 7 },
                  { semana: 2, dosis: "3 x 6-4", rpe: 8 },
                  { semana: 3, dosis: "3 x 6-4", rpe: 9 },
                  { semana: 4, dosis: "3 x 6-4", rpe: 9 },
                ],
              },
              {
                id: EJ_2_ID,
                planificacion_dia_id: DIA_1_ID,
                ejercicio_id: 902,
                categoria: "B",
                orden: 2,
                ejercicios: { id: 902, nombre: "Remo con T", grupo_muscular: "Espalda", video_url: null },
                semanas: [
                  { semana: 1, dosis: "3 x 8-6", rpe: 7 },
                  { semana: 2, dosis: "3 x 8-6", rpe: 8 },
                  { semana: 3, dosis: "3 x 8-6", rpe: 9 },
                  { semana: 4, dosis: "3 x 8-6", rpe: 9 },
                ],
              },
              {
                id: EJ_3_ID,
                planificacion_dia_id: DIA_1_ID,
                ejercicio_id: 903,
                categoria: "C",
                orden: 3,
                ejercicios: { id: 903, nombre: "Press inclinado mancuernas", grupo_muscular: "Pecho", video_url: null },
                semanas: [
                  { semana: 1, dosis: "3 x 10-8", rpe: 7 },
                  { semana: 2, dosis: "3 x 10-8", rpe: 8 },
                  { semana: 3, dosis: "3 x 10-8", rpe: 9 },
                  { semana: 4, dosis: "3 x 10-8", rpe: 9 },
                ],
              },
            ],
          },
          {
            id: DIA_2_ID,
            hoja_id: HOJA_ID,
            numero_dia: 2,
            nombre: "Pierna",
            orden: 2,
            ejercicios: [
              {
                id: 410,
                planificacion_dia_id: DIA_2_ID,
                ejercicio_id: 904,
                categoria: "A",
                orden: 1,
                ejercicios: { id: 904, nombre: "Sentadilla", grupo_muscular: "Cuadriceps", video_url: null },
                semanas: [{ semana: 1, dosis: "4 x 6", rpe: 8 }],
              },
            ],
          },
        ],
      },
    ],
  }
  const extras = opts.extraEjercicios ?? 0
  if (extras > 0) {
    const dia1 = planificacion.hojas[0].dias[0]
    for (let i = 0; i < extras; i++) {
      const ejId = 500 + i
      const ejercicioId = 950 + i
      const cat = (["C", "D", "E"] as const)[i % 3]
      dia1.ejercicios.push({
        id: ejId,
        planificacion_dia_id: DIA_1_ID,
        ejercicio_id: ejercicioId,
        categoria: cat,
        orden: 10 + i,
        ejercicios: { id: ejercicioId, nombre: `Ejercicio extra ${i + 1}`, grupo_muscular: "Accesorio", video_url: null },
        semanas: [
          { semana: 1, dosis: "3 x 10", rpe: 7 },
          { semana: 2, dosis: "3 x 10", rpe: 8 },
          { semana: 3, dosis: "3 x 10", rpe: 9 },
          { semana: 4, dosis: "3 x 10", rpe: 9 },
        ],
      } as any)
    }
  }
  return { planificacion }
}

export interface MockOptions {
  withPriorSession?: { semana: number; diaId: number; estado?: string; registros?: any[] }
  extraEjercicios?: number
}

export async function setupMockApi(page: Page, opts: MockOptions = {}) {
  const fixture = makePlanFixture({ extraEjercicios: opts.extraEjercicios })
  const savedPayloads: any[] = []
  const sessionState = new Map<string, any>()

  if (opts.withPriorSession) {
    const k = `${opts.withPriorSession.semana}-${opts.withPriorSession.diaId}`
    sessionState.set(k, {
      sesion: { id: 9000, estado: opts.withPriorSession.estado ?? "completado" },
      estado_diario: null,
      registros: opts.withPriorSession.registros ?? [],
    })
  }

  await page.route("**/test-api.local/**", async (route: Route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()

    if (path.match(/\/portal\/alumnos\/\d+\/planificacion$/) && method === "GET") {
      return route.fulfill({ json: fixture })
    }

    if (path.match(/\/portal\/planificaciones\/\d+\/sesiones\/resumen$/) && method === "GET") {
      const sesiones: any[] = []
      for (const [k, v] of sessionState) {
        const [sem, dia] = k.split("-").map(Number)
        sesiones.push({ semana: sem, dia_id: dia, estado: v.sesion?.estado ?? "abierta" })
      }
      return route.fulfill({ json: { sesiones } })
    }

    if (path.match(/\/portal\/planificaciones\/\d+\/sesiones\/semana$/) && method === "GET") {
      const semana = Number(url.searchParams.get("semana"))
      const sesiones: any[] = []
      for (const [k, v] of sessionState) {
        const [sem, dia] = k.split("-").map(Number)
        if (sem === semana) sesiones.push({ id: v.sesion?.id ?? 0, dia_id: dia, estado: v.sesion?.estado ?? "abierta" })
      }
      return route.fulfill({ json: { sesiones } })
    }

    if (path.match(/\/portal\/planificaciones\/\d+\/sesiones$/) && method === "GET") {
      const semana = Number(url.searchParams.get("semana"))
      const diaId = Number(url.searchParams.get("dia_id"))
      const key = `${semana}-${diaId}`
      const data = sessionState.get(key) ?? { sesion: null, estado_diario: null, registros: [] }
      return route.fulfill({ json: data })
    }

    if (path.match(/\/portal\/planificaciones\/\d+\/sesiones$/) && method === "PUT") {
      const body = JSON.parse(route.request().postData() ?? "{}")
      savedPayloads.push(body)
      const key = `${body.semana}-${body.dia_id}`
      const existing = sessionState.get(key)
      const existingRegistros: any[] = existing?.registros ?? []
      const incoming = (body.registros ?? []).map((r: any, i: number) => ({
        id: 10000 + i,
        planificacion_ejercicio_id: r.planificacion_ejercicio_id,
        peso_kg: r.peso_kg,
        repeticiones: r.repeticiones,
        rpe: r.rpe,
        notas: r.notas,
        series: r.series,
      }))
      // Merge by planificacion_ejercicio_id (PUT solo trae dirty ejs)
      const byId = new Map<number, any>()
      for (const r of existingRegistros) byId.set(r.planificacion_ejercicio_id, r)
      for (const r of incoming) byId.set(r.planificacion_ejercicio_id, r)
      const registrosNorm = Array.from(byId.values())
      sessionState.set(key, {
        sesion: { id: 9000 + sessionState.size + 1, estado: body.estado ?? "abierta" },
        estado_diario: {
          durmio_mal: body.durmio_mal,
          fatiga: body.fatiga,
          desmotivacion: body.desmotivacion,
          dolor: body.dolor,
          excelente: body.excelente,
        },
        registros: registrosNorm,
      })
      return route.fulfill({ json: { ok: true } })
    }

    return route.fulfill({ status: 404, json: { error: `unhandled ${method} ${path}` } })
  })

  return {
    fixture,
    savedPayloads,
    sessionState,
    getLastPayload: () => savedPayloads[savedPayloads.length - 1],
  }
}

export const PORTAL_URL = `/test-portal?studentId=${STUDENT_ID}`
