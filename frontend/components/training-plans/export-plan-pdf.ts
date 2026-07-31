import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import type { EjercicioLocal, PendingEjercicio } from "./plan-builder"
import type { PlanHoja, Planificacion } from "@/types/planificaciones"

const SEMANAS = [1, 2, 3, 4, 5, 6]

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// Paleta de impresión por categoría (fondo suave + texto oscuro)
const CAT_PRINT: Record<string, { bg: string; fg: string }> = {
  ACTIVADOR: { bg: "#fef9c3", fg: "#854d0e" },
}
const CAT_FALLBACK = { bg: "#f4f4f5", fg: "#3f3f46" }

const GREEN = hex("#16a34a")
const GREEN_SOFT = hex("#ecfdf5")
const GREEN_DARK = hex("#15803d")
const INK = hex("#18181b")
const MUTED = hex("#71717a")
const FAINT = hex("#a1a1aa")
const LINE = hex("#e4e4e7")
const HEAD_BG = hex("#fafafa")
const WHITE = rgb(1, 1, 1)

// A4 horizontal
const PAGE_W = 841.89
const PAGE_H = 595.28
const M = 34

const ROW_H = 26
const ROW_GAP = 3
const TABLE_HEAD_H = 22
const DAY_TITLE_H = 30
const DAY_GAP = 18
const RADIUS = 6

/** pdf-lib no tiene border-radius: se dibuja como path SVG. `y` es el borde inferior. */
function roundedRect(
  p: PDFPage,
  o: {
    x: number
    y: number
    w: number
    h: number
    r?: number
    color?: ReturnType<typeof rgb>
    borderColor?: ReturnType<typeof rgb>
    borderWidth?: number
    opacity?: number
  }
) {
  const r = Math.min(o.r ?? RADIUS, o.h / 2, o.w / 2)
  const { w, h } = o
  const path =
    `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} ` +
    `A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} ` +
    `V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
  p.drawSvgPath(path, {
    x: o.x,
    y: o.y + h,
    color: o.color,
    borderColor: o.borderColor,
    borderWidth: o.borderWidth ?? 0,
    opacity: o.opacity,
  })
}

type Row = {
  categoria: string
  nombre: string
  series: number
  semanas: Record<number, { dosis: string; rpe: string }>
}

interface ExportArgs {
  plan: Planificacion
  hoja: PlanHoja
  localData: Record<number, EjercicioLocal>
  pendingByDay: Record<number, PendingEjercicio[]>
  orderByDay: Record<number, number[]>
  pendingDeletes: number[]
}

type State = Omit<ExportArgs, "plan" | "hoja">

/** Filas de un día: lo guardado + las ediciones locales todavía sin guardar. */
function buildRows(dia: PlanHoja["dias"][number], { localData, pendingByDay, orderByDay, pendingDeletes }: State): Row[] {
  const order = orderByDay[dia.id]
  const guardados = dia.ejercicios
    .filter((ej) => !pendingDeletes.includes(ej.id))
    .sort((a, b) => {
      if (order) {
        const ia = order.indexOf(a.id)
        const ib = order.indexOf(b.id)
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1
        if (ib !== -1) return 1
      }
      return a.orden - b.orden
    })

  const rows: Row[] = guardados.map((ej) => {
    const local = localData[ej.id]
    const semanas: Row["semanas"] = {}
    SEMANAS.forEach((s) => {
      const sem = local?.semanas?.[s]
      // Semanas pares (2, 4, 6): si están vacías heredan dosis y RPE de la impar previa
      const prev = s % 2 === 0 ? local?.semanas?.[s - 1] : undefined
      semanas[s] = {
        dosis: sem?.dosis || (s % 2 === 0 ? prev?.dosis ?? "" : ""),
        rpe: sem?.rpe || (s % 2 === 0 ? prev?.rpe ?? "" : ""),
      }
    })
    return {
      categoria: local?.categoria ?? ej.categoria,
      nombre: ej.ejercicios?.nombre ?? "",
      series: local?.series ?? ej.series ?? 3,
      semanas,
    }
  })

  ;(pendingByDay[dia.id] ?? []).forEach((p) => {
    const semanas: Row["semanas"] = {}
    SEMANAS.forEach((s) => {
      semanas[s] = {
        dosis: p.dosis[s] || (s % 2 === 0 ? p.dosis[s - 1] ?? "" : ""),
        rpe: p.rpe[s] || (s % 2 === 0 ? p.rpe[s - 1] ?? "" : ""),
      }
    })
    rows.push({ categoria: p.categoria, nombre: p.ejercicio.nombre, series: p.series ?? 3, semanas })
  })

  return rows
}

/** WinAnsi no cubre todo lo que puede venir del input del profe. */
const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\x20-\xFF]/g, "")

function fit(text: string, font: PDFFont, size: number, maxW: number) {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text
  let out = text
  while (out.length > 1 && font.widthOfTextAtSize(out + "…", size) > maxW) out = out.slice(0, -1)
  return out + "…"
}

export async function exportPlanToPdf({ plan, hoja, ...state }: ExportArgs) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${clean(plan.nombre)} — ${clean(hoja.nombre)}`)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Columnas: Ejercicio | Series | Semana 1..6
  const contentW = PAGE_W - M * 2
  const seriesW = 48
  const semW = 80
  const ejW = contentW - seriesW - semW * SEMANAS.length
  const cols = [ejW, seriesW, ...SEMANAS.map(() => semW)]
  const colX: number[] = []
  cols.reduce((x, w) => (colX.push(x), x + w), M)

  const center = (page: PDFPage, text: string, i: number, y: number, size: number, font: PDFFont, color = INK) => {
    const t = fit(text, font, size, cols[i] - 6)
    const x = colX[i] + (cols[i] - font.widthOfTextAtSize(t, size)) / 2
    page.drawText(t, { x, y, size, font, color })
  }

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = 0

  const drawHeader = (p: PDFPage) => {
    let top = PAGE_H - M
    p.drawText(fit(clean(plan.nombre), bold, 22, contentW - 240), { x: M, y: top - 18, size: 22, font: bold, color: INK })

    const alumno = clean(plan.alumnos?.nombre ?? "")
    p.drawText(alumno ? `Alumno: ${alumno}` : "Planificación", { x: M, y: top - 35, size: 12, font: regular, color: MUTED })

    // Chip de hoja
    const chip = clean(hoja.nombre)
    const chipW = bold.widthOfTextAtSize(chip, 11) + 26
    roundedRect(p, { x: PAGE_W - M - chipW, y: top - 22, w: chipW, h: 22, r: 11, color: GREEN })
    p.drawText(chip, { x: PAGE_W - M - chipW + 13, y: top - 15, size: 11, font: bold, color: WHITE })

    top -= 46
    p.drawLine({ start: { x: M, y: top }, end: { x: PAGE_W - M, y: top }, thickness: 1.6, color: GREEN })
    return top - 22
  }

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H])
    y = drawHeader(page)
  }

  const drawDayTitle = (dia: PlanHoja["dias"][number], cont: boolean) => {
    const numero = `Día ${dia.numero_dia}`
    const numW = bold.widthOfTextAtSize(numero, 10) + 20
    roundedRect(page, {
      x: M,
      y: y - 15,
      w: numW,
      h: 19,
      r: 9.5,
      color: GREEN_SOFT,
      borderColor: hex("#bbf7d0"),
      borderWidth: 0.7,
    })
    page.drawText(numero, { x: M + 10, y: y - 10, size: 10, font: bold, color: GREEN_DARK })
    const nombre = clean(dia.nombre) + (cont ? " (cont.)" : "")
    page.drawText(fit(nombre, bold, 13, contentW - numW - 16), {
      x: M + numW + 10,
      y: y - 10,
      size: 13,
      font: bold,
      color: hex("#27272a"),
    })
    y -= DAY_TITLE_H
  }

  const drawTableHead = () => {
    const boxY = y - TABLE_HEAD_H + 4
    roundedRect(page, {
      x: M,
      y: boxY,
      w: contentW,
      h: TABLE_HEAD_H,
      color: HEAD_BG,
      borderColor: LINE,
      borderWidth: 0.7,
    })
    const ty = boxY + 7
    page.drawText("EJERCICIO", { x: colX[0] + 6, y: ty, size: 9, font: bold, color: MUTED })
    center(page, "SERIES", 1, ty, 9, bold, MUTED)
    SEMANAS.forEach((s, i) => center(page, `SEMANA ${s}`, 2 + i, ty, 9, bold, MUTED))
    y -= TABLE_HEAD_H + ROW_GAP
  }

  const drawRow = (r: Row) => {
    const c = CAT_PRINT[r.categoria] ?? CAT_FALLBACK
    const bg = hex(c.bg)
    const fg = hex(c.fg)
    const base = y - ROW_H
    roundedRect(page, { x: M, y: base, w: contentW, h: ROW_H, color: bg })

    page.drawText(fit(clean(r.nombre), bold, 10.5, cols[0] - 10), {
      x: colX[0] + 6,
      y: base + 9,
      size: 10.5,
      font: bold,
      color: fg,
    })
    center(page, String(r.series), 1, base + 9, 10.5, regular, fg)

    SEMANAS.forEach((s, i) => {
      const { dosis, rpe } = r.semanas[s]
      const col = 2 + i
      if (!dosis && !rpe) {
        center(page, "—", col, base + 9, 10, regular, rgb(0.6, 0.6, 0.62))
        return
      }
      if (rpe) {
        center(page, clean(dosis || "—"), col, base + 13, 10.5, bold, fg)
        center(page, `RPE ${clean(rpe)}`, col, base + 4, 8, regular, fg)
      } else {
        center(page, clean(dosis), col, base + 9, 10.5, bold, fg)
      }
    })

    y -= ROW_H + ROW_GAP
  }

  // ─── Contenido ───
  y = drawHeader(page)
  const dias = [...hoja.dias].sort((a, b) => a.orden - b.orden)
  const bottom = M + 18

  let algo = false
  dias.forEach((dia) => {
    const rows = buildRows(dia, state)
    if (rows.length === 0) return
    algo = true

    // Título + encabezado + al menos una fila deben entrar en la página
    if (y - (DAY_TITLE_H + TABLE_HEAD_H + ROW_H + ROW_GAP * 2) < bottom) newPage()
    drawDayTitle(dia, false)
    drawTableHead()

    rows.forEach((r) => {
      if (y - ROW_H < bottom) {
        newPage()
        drawDayTitle(dia, true)
        drawTableHead()
      }
      drawRow(r)
    })

    y -= DAY_GAP
  })

  if (!algo) {
    page.drawText("Esta hoja no tiene ejercicios cargados.", { x: M, y: y - 12, size: 12, font: regular, color: FAINT })
  }

  // Footer con paginado
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    const txt = clean(`${plan.nombre} · ${hoja.nombre} · ${i + 1}/${pages.length}`)
    p.drawText(txt, {
      x: (PAGE_W - regular.widthOfTextAtSize(txt, 9)) / 2,
      y: M - 16,
      size: 9,
      font: regular,
      color: FAINT,
    })
  })

  // ─── Descarga ───
  const bytes = await pdf.save()
  const slug = (s: string) =>
    clean(s)
      .trim()
      .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "planificacion"

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${slug(plan.nombre)}-${slug(hoja.nombre)}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
