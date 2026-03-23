"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { BarChart } from "@mui/x-charts/BarChart"
import type { BarItemIdentifier } from "@mui/x-charts"
import { queryKeys } from "@/lib/query-keys"
import { TrendingUp, TrendingDown, Users, Award, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { parseLocalDate } from "@/lib/payment-utils"
import { usePlanes, getPlanColor as getPlanColorFromList } from "@/hooks/use-planes"
import { Loader } from "@/components/ui/loader"
import { differenceInYears } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: number
  nombre: string
  modalidad: string
  fecha_de_nacimiento: string
  fecha_de_inicio: string
}

interface Payment {
  id: number
  alumno_id: number
  monto: number | string
  fecha_de_pago: string
  fecha_de_vencimiento: string
  modalidad: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
const MONTHS_LONG  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

const C = {
  activos:   "#22c55e",
  inactivos: "#f59e0b",
  altas:     "#a78bfa",
  bajas:     "#f87171",
  primary:   "#22c55e",
  secondary: "#4ade80",
  axis:      "#71717a",
  grid:      "#27272a",
}

// MUI chart shared sx — dark themed axes + custom tooltip
const chartSx = {
  "& .MuiChartsAxis-tickLabel":       { fill: C.axis,        fontSize: "11px !important" },
  "& .MuiChartsAxis-line":            { stroke: C.grid },
  "& .MuiChartsAxis-tick":            { stroke: C.grid },
  "& .MuiChartsGrid-line":            { stroke: C.grid, strokeDasharray: "4 4" },
  "& .MuiChartsLegend-root":          { display: "none" },
  // Tooltip
  "& .MuiChartsTooltip-root":         {
    background:   "#18181b !important",
    border:       "1px solid #3f3f46 !important",
    borderRadius: "10px !important",
    boxShadow:    "0 8px 32px rgba(0,0,0,.5) !important",
    padding:      "0 !important",
  },
  "& .MuiChartsTooltip-paper":        {
    background:   "transparent !important",
    boxShadow:    "none !important",
  },
  "& .MuiChartsTooltip-table":        { padding: "8px 12px !important" },
  "& .MuiChartsTooltip-cell":         { color: "#f4f4f5 !important", fontSize: "12px !important", padding: "3px 6px !important" },
  "& .MuiChartsTooltip-labelCell":    { color: "#a1a1aa !important" },
  "& .MuiChartsTooltip-markCell svg": { width: "8px !important", height: "8px !important" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatARS(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return `$${Math.round(n).toLocaleString("es-AR")}`
}

function formatARSFull(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

// ─── StyledSelect ─────────────────────────────────────────────────────────────

function StyledSelect({ value, onChange, children }: {
  value: number
  onChange: (v: number) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-600 hover:border-zinc-500 transition-colors"
    >
      {children}
    </select>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, icon, accentColor = C.primary, onClick, children }: {
  label: string
  icon?: React.ReactNode
  accentColor?: string
  onClick?: () => void
  children: React.ReactNode
}) {
  const Wrapper = onClick ? "button" : "div"
  return (
    <Wrapper
      onClick={onClick}
      className={`relative rounded-2xl bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-3 overflow-hidden text-left w-full ${onClick ? "hover:border-zinc-600 hover:bg-zinc-800/80 transition-colors cursor-pointer active:scale-[.99]" : ""}`}
    >
      {/* accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accentColor }} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">{label}</span>
        {icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accentColor}18` }}>
            <span style={{ color: accentColor }}>{icon}</span>
          </div>
        )}
      </div>
      {children}
    </Wrapper>
  )
}

// ─── ChartCard ────────────────────────────────────────────────────────────────

function ChartCard({ title, action, children, className = "" }: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-4 h-full ${className}`}>
      <div className="flex items-center justify-between min-h-[28px]">
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color = C.primary }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(value, 100)}%`, background: color }}
      />
    </div>
  )
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  const clampedEnd = Math.min(endDeg, startDeg + 359.99) // avoid full-circle degenerate
  const large = clampedEnd - startDeg > 180 ? 1 : 0
  const o1 = polarToXY(cx, cy, outerR, startDeg)
  const o2 = polarToXY(cx, cy, outerR, clampedEnd)
  const i1 = polarToXY(cx, cy, innerR, clampedEnd)
  const i2 = polarToXY(cx, cy, innerR, startDeg)
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ")
}

function DonutChart({ segments, size = 200, onSelect }: {
  segments: { value: number; color: string; label: string }[]
  size?: number
  onSelect: (label: string) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const total = segments.reduce((s, d) => s + d.value, 0)

  if (total === 0) return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center">
      <span className="text-sm text-zinc-500">Sin datos</span>
    </div>
  )

  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 2
  const innerR = outerR * 0.62
  const GAP_DEG = 0

  let accDeg = 0
  const arcs = segments.map(seg => {
    const sweep = (seg.value / total) * 360
    const start = accDeg + GAP_DEG / 2
    const end   = accDeg + sweep - GAP_DEG / 2
    accDeg += sweep
    return { ...seg, start, end }
  })

  const pad = 8
  return (
    <div className="relative" style={{ width: size + pad * 2, height: size + pad * 2 }}>
      <svg width={size + pad * 2} height={size + pad * 2} viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`} overflow="visible">
        {arcs.map((arc) => {
          const isHovered = hovered === arc.label
          const scale = isHovered ? 1.04 : 1
          return (
            <path
              key={arc.label}
              d={arcPath(cx, cy, outerR, innerR, arc.start, arc.end)}
              fill={arc.color}
              opacity={hovered && !isHovered ? 0.45 : 1}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: `${cx}px ${cy}px`,
                transition: "transform .15s ease, opacity .15s ease",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHovered(arc.label)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(arc.label)}
            />
          )
        })}
      </svg>
      {/* center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {hovered ? (
          <>
            <span className="text-2xl font-bold text-zinc-100 leading-none">
              {segments.find(s => s.label === hovered)?.value ?? 0}
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">{hovered}</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold text-zinc-100 leading-none">{total}</span>
            <span className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">total</span>
          </>
        )}
      </div>
    </div>
  )
}

// ─── StudentsDrillDialog ──────────────────────────────────────────────────────

function StudentsDrillDialog({ category, students, color, getColor, onClose }: {
  category: string
  students: Student[]
  color: string
  getColor: (nombre: string) => string
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-md bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[80vh] flex flex-col pr-14">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
            {category}
            <span className="ml-auto text-sm font-normal text-zinc-400">{students.length} alumnos</span>
          </DialogTitle>
        </DialogHeader>
        {students.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">Sin alumnos en esta categoría</p>
        ) : (
          <div className="overflow-y-auto flex flex-col divide-y divide-zinc-800 -mx-6 px-6">
            {students.map(s => (
              <div key={s.id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 text-xs font-bold text-zinc-300">
                    {s.nombre.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium truncate">{s.nombre}</span>
                </div>
                <span
                  className="text-xs font-medium shrink-0 px-2 py-0.5 rounded-md"
                  style={{ color: getColor(s.modalidad || ""), background: `${getColor(s.modalidad || "")}20` }}
                >
                  {s.modalidad || "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── PaymentsDrillDialog ──────────────────────────────────────────────────────

function PaymentsDrillDialog({ title, payments, getColor, onClose }: {
  title: string
  payments: (Payment & { alumno_nombre?: string })[]
  getColor: (nombre: string) => string
  onClose: () => void
}) {
  const total = payments.reduce((s, p) => s + Number(p.monto), 0)
  const showName = payments.some(p => p.alumno_nombre)
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-md bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[80vh] flex flex-col pr-14">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: C.primary }} />
            {title}
            <span className="ml-auto text-sm font-normal text-zinc-400">{payments.length} pagos</span>
          </DialogTitle>
        </DialogHeader>
        <div className="shrink-0 flex items-center justify-between px-1 pb-2 border-b border-zinc-800">
          <span className="text-xs text-zinc-500">Total del período</span>
          <span className="text-sm font-semibold text-green-400">{formatARSFull(total)}</span>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">Sin pagos en este período</p>
        ) : (
          <div className="overflow-y-auto flex flex-col divide-y divide-zinc-800 -mx-6 px-6">
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {showName && (
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 text-xs font-bold text-zinc-300">
                      {(p.alumno_nombre ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    {showName && <span className="text-sm font-medium truncate">{p.alumno_nombre}</span>}
                    <span className={showName ? "text-[11px] text-zinc-400" : "text-sm font-medium text-zinc-100"}>
                      {formatARSFull(Number(p.monto))}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {p.fecha_de_pago ? p.fecha_de_pago.split("-").reverse().join("/") : "—"}
                    </span>
                  </div>
                </div>
                <span
                  className="text-xs font-medium shrink-0 px-2 py-0.5 rounded-md"
                  style={{ color: getColor(p.modalidad || ""), background: `${getColor(p.modalidad || "")}20` }}
                >
                  {p.modalidad || "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── DonutLegend ─────────────────────────────────────────────────────────────

const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  Activos:   "Plan vigente, sin vencer",
  Inactivos: "Vencido hace 1–14 días",
  Altas:     "Nuevos este mes",
  Bajas:     "Vencido hace más de 15 días",
}

function DonutLegend({ segments, onSelect }: {
  segments: { value: number; color: string; label: string }[]
  onSelect: (label: string) => void
}) {
  const total = segments.reduce((s, d) => s + d.value, 0)
  return (
    <div className="grid grid-cols-2 place-items-center sm:flex sm:flex-row sm:justify-around sm:items-center gap-4 w-full">
      {segments.map(s => (
        <button
          key={s.label}
          onClick={() => onSelect(s.label)}
          className="group relative flex items-start gap-2.5 text-left hover:opacity-80 active:scale-95 transition-all cursor-pointer"
        >
          <div className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-zinc-400 leading-none group-hover:text-zinc-200 transition-colors">{s.label}</span>
              <span className="w-3.5 h-3.5 rounded-full bg-zinc-700 text-zinc-400 text-[9px] flex items-center justify-center cursor-default leading-none shrink-0">?</span>
            </div>
            <span className="text-xl font-bold text-zinc-100 leading-none mt-1">{s.value}</span>
            <span className="text-[10px] text-zinc-600 mt-0.5">{pct(s.value, total)}%</span>
          </div>
          {/* description tooltip */}
          <div className="pointer-events-none absolute bottom-full left-0 mb-2 z-20 hidden group-hover:block">
            <div className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
              {SEGMENT_DESCRIPTIONS[s.label] ?? s.label}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EstadisticasSection() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const [selectedYear,  setSelectedYear]  = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth())
  const [billingYear,   setBillingYear]   = useState(today.getFullYear())

  const { data: planes = [] } = usePlanes()
  const planColor = (nombre: string) => getPlanColorFromList(planes, nombre)

  const { data: students = [], isLoading: ls } = useQuery<Student[]>({
    queryKey: queryKeys.students,
    queryFn: () => axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllStudents`).then(r => r.data),
  })

  const { data: payments = [], isLoading: lp } = useQuery<Payment[]>({
    queryKey: queryKeys.payments,
    queryFn: () => axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllPayments`).then(r => r.data),
  })

  const { data: paymentHistory = [] } = useQuery<Payment[]>({
    queryKey: queryKeys.allPaymentHistory,
    queryFn: () => axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/payments/history`).then(r => r.data),
  })

  const stats = useMemo(() => {
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1
    const prevYear  = selectedMonth === 0 ? selectedYear - 1 : selectedYear

    const billingFor = (month: number, year: number) =>
      paymentHistory
        .filter(p => { const d = parseLocalDate(p.fecha_de_pago); return d && d.getMonth() === month && d.getFullYear() === year })
        .reduce((s, p) => s + Number(p.monto), 0)

    const currentBilling = billingFor(selectedMonth, selectedYear)
    const prevBilling    = billingFor(prevMonth, prevYear)
    const billingDiff    = prevBilling > 0 ? ((currentBilling - prevBilling) / prevBilling) * 100 : 0
    const monthlyBilling = Array.from({ length: 12 }, (_, m) => billingFor(m, billingYear))

    const latestPay = new Map<number, Payment>()
    payments.forEach(p => {
      const existing = latestPay.get(p.alumno_id)
      if (!existing) { latestPay.set(p.alumno_id, p); return }
      const a = parseLocalDate(p.fecha_de_vencimiento)
      const b = parseLocalDate(existing.fecha_de_vencimiento)
      if (a && b && a > b) latestPay.set(p.alumno_id, p)
    })

    const activosList: Student[]   = []
    const inactivosList: Student[] = []
    const bajasList: Student[]     = []
    students.forEach(s => {
      const p   = latestPay.get(s.id)
      if (!p)   { bajasList.push(s); return }
      const exp = parseLocalDate(p.fecha_de_vencimiento)
      if (!exp) { bajasList.push(s); return }
      const days = Math.floor((today.getTime() - exp.getTime()) / 86400000)
      if      (days <= 0)  activosList.push(s)
      else if (days <= 14) inactivosList.push(s)
      else                 bajasList.push(s)
    })
    const activos   = activosList.length
    const inactivos = inactivosList.length
    const bajas     = bajasList.length

    const altasList = students.filter(s => {
      const d = parseLocalDate(s.fecha_de_inicio)
      return d && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    })
    const altas = altasList.length

    const studentMap = new Map(students.map(s => [s.id, s]))

    // Pagos del mes seleccionado (para drill facturación)
    const currentMonthPayments = paymentHistory
      .filter(p => { const d = parseLocalDate(p.fecha_de_pago); return d && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear })
      .map(p => ({ ...p, alumno_nombre: studentMap.get(p.alumno_id)?.nombre ?? "—" }))

    const planCount: Record<string, number> = {}
    students.forEach(s => { if (s.modalidad) planCount[s.modalidad] = (planCount[s.modalidad] || 0) + 1 })
    const topPlanEntry   = Object.entries(planCount).sort((a, b) => b[1] - a[1])[0] ?? ["—", 0]
    const topPlanPct     = pct(topPlanEntry[1], students.length)
    const topPlanStudents = students.filter(s => s.modalidad === topPlanEntry[0])

    const plansCurr: Record<string, number> = {}
    const plansPrev: Record<string, number> = {}
    const planPaymentsCurr: Record<string, (Payment & { alumno_nombre: string })[]> = {}
    const planPaymentsPrev: Record<string, (Payment & { alumno_nombre: string })[]> = {}
    paymentHistory.forEach(p => {
      const d = parseLocalDate(p.fecha_de_pago)
      if (!d || !p.modalidad) return
      const s = studentMap.get(p.alumno_id)
      const enriched = { ...p, alumno_nombre: s?.nombre ?? "—" }
      if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
        plansCurr[p.modalidad] = (plansCurr[p.modalidad] || 0) + Number(p.monto)
        if (!planPaymentsCurr[p.modalidad]) planPaymentsCurr[p.modalidad] = []
        planPaymentsCurr[p.modalidad].push(enriched)
      }
      if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
        plansPrev[p.modalidad] = (plansPrev[p.modalidad] || 0) + Number(p.monto)
        if (!planPaymentsPrev[p.modalidad]) planPaymentsPrev[p.modalidad] = []
        planPaymentsPrev[p.modalidad].push(enriched)
      }
    })
    const planNames = [...new Set([...Object.keys(plansCurr), ...Object.keys(plansPrev)])]

    const ageKeys = ["0-12","13-17","18-25","26-35","36-45","46-60","60+"] as const
    const ageGroups: Record<string, number> = Object.fromEntries(ageKeys.map(k => [k, 0]))
    const studentsByAge: Record<string, Student[]> = Object.fromEntries(ageKeys.map(k => [k, []]))
    students.forEach(s => {
      const d = parseLocalDate(s.fecha_de_nacimiento)
      if (!d) return
      const age = differenceInYears(today, d)
      let key: string
      if      (age <= 12) key = "0-12"
      else if (age <= 17) key = "13-17"
      else if (age <= 25) key = "18-25"
      else if (age <= 35) key = "26-35"
      else if (age <= 45) key = "36-45"
      else if (age <= 60) key = "46-60"
      else                key = "60+"
      ageGroups[key]++
      studentsByAge[key].push(s)
    })

    const yearsSet = new Set<number>([today.getFullYear()])
    paymentHistory.forEach(p => { const d = parseLocalDate(p.fecha_de_pago); if (d) yearsSet.add(d.getFullYear()) })
    students.forEach(s => { const d = parseLocalDate(s.fecha_de_inicio);     if (d) yearsSet.add(d.getFullYear()) })
    const years = [...yearsSet].sort((a, b) => b - a)

    return {
      currentBilling, prevBilling, billingDiff, monthlyBilling,
      activos, inactivos, bajas, altas,
      activosList, inactivosList, bajasList, altasList,
      currentMonthPayments,
      total: students.length,
      topPlanEntry, topPlanPct, topPlanStudents,
      planNames, plansCurr, plansPrev, planPaymentsCurr, planPaymentsPrev,
      ageGroups, studentsByAge, years,
    }
  }, [students, payments, paymentHistory, selectedYear, selectedMonth, billingYear, today])

  // ── Drill state — must be before any early return ──────────────────────────
  const [drillCategory, setDrillCategory] = useState<string | null>(null)
  const [drillStudents, setDrillStudents] = useState<{ title: string; list: Student[] } | null>(null)
  const [drillPayments, setDrillPayments] = useState<{ title: string; list: (Payment & { alumno_nombre?: string })[] } | null>(null)

  if (ls || lp) return <Loader />

  const {
    currentBilling, prevBilling, billingDiff, monthlyBilling,
    activos, inactivos, bajas, altas,
    activosList, inactivosList, bajasList, altasList,
    currentMonthPayments,
    total,
    topPlanEntry, topPlanPct, topPlanStudents,
    planNames, plansCurr, plansPrev, planPaymentsCurr, planPaymentsPrev,
    ageGroups, studentsByAge, years,
  } = stats

  const drillData: Record<string, Student[]> = {
    Activos: activosList, Inactivos: inactivosList, Altas: altasList, Bajas: bajasList,
  }

  const prevMonth      = selectedMonth === 0 ? 11 : selectedMonth - 1
  const longPlanNames  = planNames.some(p => p.length > 8)

  const donutSegments = [
    { value: activos,   color: C.activos,   label: "Activos"   },
    { value: inactivos, color: C.inactivos, label: "Inactivos" },
    { value: altas,     color: C.altas,     label: "Altas"     },
    { value: bajas,     color: C.bajas,     label: "Bajas"     },
  ]

  // shared axis style for MUI charts
  const axisStyle = { tickLabelStyle: { fill: C.axis, fontSize: 11 } }

  return (
    <div className="space-y-5 pb-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Estadísticas</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Resumen general del negocio</p>
        </div>
        {/* Global filters (year + month) apply to Facturación KPI, Altas, Plan comparison */}
        <div className="flex items-center gap-2">
          <StyledSelect value={selectedYear} onChange={setSelectedYear}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </StyledSelect>
          <StyledSelect value={selectedMonth} onChange={setSelectedMonth}>
            {MONTHS_LONG.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </StyledSelect>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Facturación */}
        <StatCard label="Facturación del mes" icon={<TrendingUp className="h-3.5 w-3.5" />} accentColor={C.primary}
          onClick={() => setDrillPayments({ title: `Pagos — ${MONTHS_LONG[selectedMonth]} ${selectedYear}`, list: currentMonthPayments })}
        >
          <div>
            <p className="text-3xl font-bold text-zinc-100 leading-none tracking-tight">
              {formatARSFull(currentBilling)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Mes ant.: {formatARSFull(prevBilling)}</span>
            {billingDiff !== 0 && (
              <span className={`flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-md text-[11px] ${
                billingDiff > 0
                  ? "text-green-400 bg-green-400/10"
                  : "text-red-400 bg-red-400/10"
              }`}>
                {billingDiff > 0
                  ? <TrendingUp className="h-3 w-3"/>
                  : <TrendingDown className="h-3 w-3"/>}
                {Math.abs(billingDiff).toFixed(1)}%
              </span>
            )}
          </div>
        </StatCard>

        {/* Activos */}
        <StatCard label="Alumnos activos" icon={<Users className="h-3.5 w-3.5" />} accentColor={C.activos}
          onClick={() => setDrillStudents({ title: "Alumnos Activos", list: activosList })}
        >
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-zinc-100 leading-none tracking-tight">
              {pct(activos, total)}<span className="text-lg text-zinc-400 ml-0.5">%</span>
            </p>
            <span className="text-xs text-zinc-500 mb-0.5">{activos} / {total}</span>
          </div>
          <ProgressBar value={pct(activos, total)} color={C.activos} />
        </StatCard>

        {/* Plan más frecuente */}
        <StatCard label="Plan más frecuente" icon={<Award className="h-3.5 w-3.5" />} accentColor={planColor(topPlanEntry[0])}
          onClick={() => setDrillStudents({ title: `Plan: ${topPlanEntry[0]}`, list: topPlanStudents })}
        >
          <p className="text-2xl font-bold leading-tight truncate" style={{ color: planColor(topPlanEntry[0]) }}>{topPlanEntry[0]}</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">{topPlanEntry[1]} alumnos</span>
              <span className="font-semibold" style={{ color: planColor(topPlanEntry[0]) }}>{topPlanPct}%</span>
            </div>
            <ProgressBar value={topPlanPct} color={planColor(topPlanEntry[0])} />
          </div>
        </StatCard>
      </div>

      {/* ── Donut + Facturación anual ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Donut */}
        <ChartCard title="Estado de alumnos" className="lg:col-span-2">
          <div className="flex flex-col items-center justify-center gap-6 flex-1 py-2">
            <DonutChart segments={donutSegments} size={260} onSelect={setDrillCategory} />
            <DonutLegend segments={donutSegments} onSelect={setDrillCategory} />
          </div>
        </ChartCard>

        {/* Facturación mensual */}
        <ChartCard
          title="Facturación mensual"
          className="lg:col-span-3"
          action={
            <StyledSelect value={billingYear} onChange={setBillingYear}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </StyledSelect>
          }
        >
          <BarChart
            xAxis={[{ scaleType: "band", data: MONTHS_SHORT, ...axisStyle }]}
            yAxis={[{
              valueFormatter: (v: number) =>
                v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M`
                : v >= 1000    ? `$${(v/1000).toFixed(0)}k`
                : `$${v}`,
              tickLabelStyle: { fill: C.axis, fontSize: 10 },
            }]}
            series={[{
              data: monthlyBilling,
              label: "Facturación",
              color: C.primary,
              valueFormatter: (v: number | null) => v !== null ? formatARSFull(v) : "$0",
            }]}
            height={260}
            margin={{ left: 0, right: 16, top: 8, bottom: 0 }}
            tooltip={{ trigger: "item" }}
            borderRadius={6}
            sx={{ width: "100%", ...chartSx }}
          />
        </ChartCard>
      </div>

      {/* ── Edad + Plan comparison ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Edad */}
        <ChartCard title="Distribución por edad" className="lg:col-span-3">
          <BarChart
            xAxis={[{ scaleType: "band", data: Object.keys(ageGroups), ...axisStyle }]}
            yAxis={[{ tickLabelStyle: { fill: C.axis, fontSize: 10 } }]}
            series={[{
              data: Object.values(ageGroups),
              label: "Alumnos",
              color: C.primary,
              valueFormatter: (v: number | null) => `${v ?? 0} alumnos`,
            }]}
            height={260}
            margin={{ left: 0, right: 16, top: 8, bottom: 24 }}
            tooltip={{ trigger: "item" }}
            borderRadius={6}
            sx={{ width: "100%", ...chartSx, "& .MuiBarElement-root": { cursor: "pointer" } }}
            onItemClick={(_e: React.MouseEvent, d: BarItemIdentifier) => {
              const key = Object.keys(ageGroups)[d.dataIndex]
              if (key) setDrillStudents({ title: `Edad: ${key} años`, list: studentsByAge[key] ?? [] })
            }}
          />
        </ChartCard>

        {/* Plan comparison */}
        <ChartCard
          title="Facturación por plan"
          className="lg:col-span-2"
          action={
            <span className="text-[11px] text-zinc-500 font-medium">
              {MONTHS_SHORT[selectedMonth]} vs {MONTHS_SHORT[prevMonth]}
            </span>
          }
        >
          {planNames.length === 0 ? (
            <div className="flex items-center justify-center flex-1 py-16">
              <span className="text-sm text-zinc-600">Sin datos para este período</span>
            </div>
          ) : (
            <BarChart
              xAxis={[{
                scaleType: "band",
                data: planNames,
                tickLabelStyle: longPlanNames
                  ? { angle: -30, textAnchor: "end", fill: C.axis, fontSize: 9 }
                  : { fill: C.axis, fontSize: 10 },
              }]}
              yAxis={[{
                valueFormatter: (v: number) => formatARS(v),
                tickLabelStyle: { fill: C.axis, fontSize: 10 },
              }]}
              series={[
                {
                  id: "curr",
                  data: planNames.map(p => plansCurr[p] ?? 0),
                  label: MONTHS_LONG[selectedMonth],
                  color: C.primary,
                  valueFormatter: (v: number | null) => formatARSFull(v ?? 0),
                },
                {
                  id: "prev",
                  data: planNames.map(p => plansPrev[p] ?? 0),
                  label: MONTHS_LONG[prevMonth],
                  color: C.secondary,
                  valueFormatter: (v: number | null) => formatARSFull(v ?? 0),
                },
              ]}
              height={260}
              margin={{ left: 0, right: 16, top: 8, bottom: longPlanNames ? 56 : 24 }}
              tooltip={{ trigger: "axis" }}
              borderRadius={6}
              sx={{ width: "100%", ...chartSx, "& .MuiBarElement-root": { cursor: "pointer" } }}
              onItemClick={(_e: React.MouseEvent, d: BarItemIdentifier) => {
                const plan = planNames[d.dataIndex]
                if (!plan) return
                const isPrev = d.seriesId === "prev"
                const list = isPrev ? (planPaymentsPrev[plan] ?? []) : (planPaymentsCurr[plan] ?? [])
                const monthLabel = isPrev ? MONTHS_LONG[prevMonth] : MONTHS_LONG[selectedMonth]
                setDrillPayments({ title: `${plan} — ${monthLabel}`, list })
              }}
            />
          )}
          {/* legend manual */}
          <div className="flex items-center gap-5 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: C.primary }} />
              <span className="text-[11px] text-zinc-400">{MONTHS_LONG[selectedMonth]}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: C.secondary }} />
              <span className="text-[11px] text-zinc-400">{MONTHS_LONG[prevMonth]}</span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Donut drill */}
      {drillCategory && (
        <StudentsDrillDialog
          category={drillCategory}
          students={drillData[drillCategory] ?? []}
          color={donutSegments.find(s => s.label === drillCategory)?.color ?? C.primary}
          getColor={planColor}
          onClose={() => setDrillCategory(null)}
        />
      )}

      {/* KPI / age drill — students */}
      {drillStudents && (
        <StudentsDrillDialog
          category={drillStudents.title}
          students={drillStudents.list}
          color={C.primary}
          getColor={planColor}
          onClose={() => setDrillStudents(null)}
        />
      )}

      {/* KPI drill — payments */}
      {drillPayments && (
        <PaymentsDrillDialog
          title={drillPayments.title}
          payments={drillPayments.list}
          getColor={planColor}
          onClose={() => setDrillPayments(null)}
        />
      )}
    </div>
  )
}
