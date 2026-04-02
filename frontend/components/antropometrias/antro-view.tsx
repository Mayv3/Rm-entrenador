"use client"

import { BarChart } from "@mui/x-charts/BarChart"
import { LineChart } from "@mui/x-charts/LineChart"
import { useMediaQuery } from "@mui/material"

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface MedidaVal {
  actual: string | null
  anterior: string | null
  diferencia: string | null
  scoreZ: string | null
}

export interface MasaVal {
  kgAnterior: string | null
  porcentaje: string | null
  kgActual: string | null
}

export interface ParsedAntro {
  nombre: string | null
  edad: string | null
  nMedicion: string | null
  fecha: string | null
  basicos: {
    peso: MedidaVal
    talla: MedidaVal
    tallaSentado: MedidaVal
  }
  diametros: {
    biacromial: MedidaVal
    toraxTransverso: MedidaVal
    toraxAnteroposterior: MedidaVal
    biIliocrestideo: MedidaVal
    humeralBiepicondilar: MedidaVal
    femoralBiepicondilar: MedidaVal
  }
  perimetros: {
    cabeza: MedidaVal
    brazoRelajado: MedidaVal
    brazoFlexionado: MedidaVal
    antebrazo: MedidaVal
    toraxMesoesternal: MedidaVal
    cintura: MedidaVal
    caderas: MedidaVal
    musloSuperior: MedidaVal
    musloMedial: MedidaVal
    pantorrillaMaxima: MedidaVal
  }
  pliegues: {
    triceps: MedidaVal
    subescapular: MedidaVal
    supraespinal: MedidaVal
    abdominal: MedidaVal
    musloMedial: MedidaVal
    pantorrilla: MedidaVal
  }
  masas: {
    adiposa: MasaVal
    muscular: MasaVal
    residual: MasaVal
    osea: MasaVal
    piel: MasaVal
  }
  _debug?: Record<string, unknown>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function v(val: string | null) {
  return val ?? "—"
}

function parseVal(val: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(",", "."))
  return isNaN(n) ? null : n
}

// ── Tabla ──────────────────────────────────────────────────────────────────────

function TableSection({ label, rows, hideScoreZ }: { label: string; rows: [string, MedidaVal][]; hideScoreZ?: boolean }) {
  return (
    <div className="flex flex-col">
      <div className="bg-gradient-to-r from-green-600 to-green-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-green-100">
        {label}
      </div>
      {rows.map(([name, m], i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
        >
          <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 leading-tight">{name}</span>
          <span className="text-xs font-semibold tabular-nums w-10 text-right">{v(m.actual)}</span>
          <span className="text-xs italic text-red-400 tabular-nums w-10 text-right">{m.anterior ?? "—"}</span>
          <span className="text-xs tabular-nums w-10 text-right text-gray-600 dark:text-gray-400">
            {m.diferencia ?? "—"}
          </span>
          {!hideScoreZ && (
            <span className="text-xs font-medium text-blue-500 tabular-nums w-10 text-right">
              {m.scoreZ ?? "—"}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Gráficos ───────────────────────────────────────────────────────────────────

function PesoChart({ peso }: { peso: MedidaVal }) {
  const actual = parseVal(peso.actual)
  if (actual === null) return null
  const anterior = parseVal(peso.anterior)

  if (anterior !== null) {
    const diff = actual - anterior
    const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)
    return (
      <div className="rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-500 text-center text-xs font-bold uppercase tracking-widest py-2 flex items-center justify-center gap-3 text-white">
          <span>Peso (kg)</span>
          <span className="text-xs font-semibold text-white">{diffStr} kg</span>
        </div>
        <LineChart
          xAxis={[{ scaleType: "band", data: ["Anterior", "Actual"], tickLabelStyle: { fontSize: 10 } }]}
          yAxis={[{ label: "kg", labelStyle: { fontSize: 10 } }]}
          series={[{
            data: [anterior, actual],
            label: "Peso (kg)",
            color: "#16a34a",
            valueFormatter: (v) => `${v} kg`,
            showMark: true,
            curve: "linear",
          }]}
          height={260}
          margin={{ left: 0, right: 20, top: 20, bottom: 0 }}
          tooltip={{ trigger: "axis" }}
          sx={{ width: "100%" }}
        />
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-center text-xs font-bold uppercase tracking-widest py-2 text-white">
        Peso (kg)
      </div>
      <BarChart
        xAxis={[{ scaleType: "band", data: ["Actual"], tickLabelStyle: { fontSize: 10 } }]}
        yAxis={[{ label: "kg", labelStyle: { fontSize: 10 } }]}
        series={[{ data: [actual], label: "Peso (kg)", color: "#16a34a", valueFormatter: (v) => `${v} kg` }]}
        height={260}
        margin={{ left: 0, right: 20, top: 20, bottom: 0 }}
        tooltip={{ trigger: "item" }}
        borderRadius={8}
        sx={{ width: "100%" }}
      />
    </div>
  )
}

function DiffBarChart({ title, rows, unit = "" }: { title: string; rows: [string, MedidaVal][]; unit?: string }) {
  const filtered = rows.filter(([, m]) => m.diferencia !== null && m.anterior !== null && m.actual !== null)
  if (filtered.length === 0) return null

  const labels = filtered.map(([label]) => label)
  const actuals = filtered.map(([, m]) => parseVal(m.actual) ?? 0)
  const anteriores = filtered.map(([, m]) => parseVal(m.anterior) ?? 0)
  const hasMany = labels.length > 5

  return (
    <div className="rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-center text-xs font-bold uppercase tracking-widest py-2 text-white">
        {title}
      </div>
      <BarChart
        xAxis={[{
          scaleType: "band",
          data: labels,
          tickLabelStyle: hasMany ? { angle: -35, textAnchor: "end", fontSize: 9 } : { fontSize: 10 },
        }]}
        yAxis={[{ label: unit, labelStyle: { fontSize: 10 } }]}
        series={[
          { data: actuals, label: "Actual", color: "#16a34a", valueFormatter: (v) => `${v}${unit ? " " + unit : ""}` },
          { data: anteriores, label: "Anterior", color: "#86efac", valueFormatter: (v) => `${v}${unit ? " " + unit : ""}` },
        ]}
        height={hasMany ? 320 : 280}
        margin={{ left: 0, right: 20, top: 20, bottom: 0 }}
        tooltip={{ trigger: "axis" }}
        borderRadius={8}
        sx={{ width: "100%" }}
      />
    </div>
  )
}

function MasasChart({ masas }: { masas: ParsedAntro["masas"] }) {
  const rows: [string, MasaVal][] = [
    ["Adiposa", masas.adiposa],
    ["Muscular", masas.muscular],
  ]
  const filtered = rows.filter(([, m]) => m.kgActual !== null && m.kgAnterior !== null)
  if (filtered.length === 0) return null

  const labels = filtered.map(([label]) => label)
  const actuals = filtered.map(([, m]) => parseVal(m.kgActual) ?? 0)
  const anteriores = filtered.map(([, m]) => parseVal(m.kgAnterior) ?? 0)

  return (
    <div className="rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-center text-xs font-bold uppercase tracking-widest py-2 text-white">
        Masas Corporales (kg)
      </div>
      <BarChart
        xAxis={[{ scaleType: "band", data: labels, tickLabelStyle: { fontSize: 10 } }]}
        yAxis={[{ label: "kg", labelStyle: { fontSize: 10 } }]}
        series={[
          { data: actuals, label: "Actual", color: "#16a34a", valueFormatter: (v) => `${v} kg` },
          { data: anteriores, label: "Anterior", color: "#86efac", valueFormatter: (v) => `${v} kg` },
        ]}
        height={280}
        margin={{ left: 0, right: 20, top: 20, bottom: 0 }}
        tooltip={{ trigger: "axis" }}
        borderRadius={8}
        sx={{ width: "100%" }}
      />
    </div>
  )
}

// ── Vista principal ────────────────────────────────────────────────────────────

export function AntroView({ data, hideScoreZ, fechaFallback }: { data: ParsedAntro; hideScoreZ?: boolean; fechaFallback?: string }) {
  const isMobile = useMediaQuery("(max-width: 640px)")

  const basicos: [string, MedidaVal][] = [
    ["Peso (kg)", data.basicos.peso],
  ]
  const perimetros: [string, MedidaVal][] = [
    ["Cabeza", data.perimetros.cabeza],
    ["Brazo Relajado", data.perimetros.brazoRelajado],
    ["Brazo Flexionado en Tensión", data.perimetros.brazoFlexionado],
    ["Antebrazo", data.perimetros.antebrazo],
    ["Tórax Mesoesternal", data.perimetros.toraxMesoesternal],
    ["Cintura (mínima)", data.perimetros.cintura],
    ["Caderas (máxima)", data.perimetros.caderas],
    ["Muslo (superior)", data.perimetros.musloSuperior],
    ["Muslo (medial)", data.perimetros.musloMedial],
    ["Pantorrilla (máxima)", data.perimetros.pantorrillaMaxima],
  ]
  const pliegues: [string, MedidaVal][] = [
    ["Tríceps", data.pliegues.triceps],
    ["Subescapular", data.pliegues.subescapular],
    ["Supraespinal", data.pliegues.supraespinal],
    ["Abdominal", data.pliegues.abdominal],
    ["Muslo (medial)", data.pliegues.musloMedial],
    ["Pantorrilla", data.pliegues.pantorrilla],
  ]

  return (
    <div className="flex flex-col gap-4">

      {/* Encabezado */}
      <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="bg-gradient-to-r from-green-600 to-green-500 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-green-100 mb-0.5">Alumno</p>
          <p className="text-lg font-bold text-white leading-tight">{data.nombre ?? "—"}</p>
        </div>
        <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800">
          <div className="flex flex-col items-center py-3 px-2 gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Edad</span>
            <span className="text-base font-bold text-gray-800 dark:text-gray-100">{data.edad ?? "—"}</span>
          </div>
          <div className="flex flex-col items-center py-3 px-2 gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Talla</span>
            <span className="text-base font-bold text-gray-800 dark:text-gray-100">
              {data.basicos.talla.actual ? `${data.basicos.talla.actual} cm` : "—"}
            </span>
          </div>
          <div className="flex flex-col items-center py-3 px-2 gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Medición</span>
            <span className="text-base font-bold text-gray-800 dark:text-gray-100">#{data.nMedicion ?? "—"}</span>
          </div>
          <div className="flex flex-col items-center py-3 px-2 gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Fecha</span>
            <span className="text-base font-bold text-gray-800 dark:text-gray-100">
              {(() => {
                const raw = data.fecha ?? fechaFallback
                if (!raw) return "—"
                const [y, m, d] = raw.split("-")
                return d && m && y ? `${d}/${m}/${y}` : raw
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* Tabla principal */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <span className="flex-1" />
          <span className="text-[10px] font-semibold text-gray-500 tabular-nums w-10 text-right">Actual</span>
          <span className="text-[10px] font-semibold text-red-400 italic tabular-nums w-10 text-right">Ant.</span>
          <span className="text-[10px] font-semibold text-gray-400 tabular-nums w-10 text-right">Dif.</span>
          {!hideScoreZ && <span className="text-[10px] font-semibold text-blue-500 tabular-nums w-10 text-right">Z</span>}
        </div>
        <TableSection label="Básicos" rows={basicos} hideScoreZ={hideScoreZ} />
        <TableSection label="Perímetros (cm)" rows={perimetros} hideScoreZ={hideScoreZ} />
        <TableSection label="Pliegues (mm)" rows={pliegues} hideScoreZ={hideScoreZ} />
      </div>

      {/* Masas */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-500 text-center text-xs font-bold uppercase tracking-widest py-2 text-white">
          Masas Corporales
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <span className="flex-1" />
          <span className="text-[10px] font-semibold text-gray-500 tabular-nums w-10 text-right">Actual</span>
          <span className="text-[10px] font-semibold text-red-400 italic tabular-nums w-10 text-right">Ant.</span>
        </div>
        {([
          ["Masa Adiposa", data.masas.adiposa],
          ["Masa Muscular", data.masas.muscular],
          ["Masa Residual", data.masas.residual],
          ["Masa Ósea", data.masas.osea],
          ["Masa de la Piel", data.masas.piel],
        ] as [string, MasaVal][]).map(([label, m]) => (
          <div key={label} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">{label}</span>
            <span className="text-xs font-semibold tabular-nums w-10 text-right">{v(m.kgActual)}</span>
            <span className="text-xs italic text-red-400 tabular-nums w-10 text-right">{m.kgAnterior ?? "—"}</span>
          </div>
        ))}
        {/* Índices calculados */}
        {(() => {
          const indicesData: { label: string; actual: string | null; anterior: string | null }[] = []
          const adipActual = parseVal(data.masas.adiposa.kgActual)
          const oseaActual = parseVal(data.masas.osea.kgActual)
          const muscActual = parseVal(data.masas.muscular.kgActual)
          const adipAnt = parseVal(data.masas.adiposa.kgAnterior)
          const oseaAnt = parseVal(data.masas.osea.kgAnterior)
          const muscAnt = parseVal(data.masas.muscular.kgAnterior)
          if (adipActual !== null && oseaActual !== null && oseaActual !== 0) {
            indicesData.push({
              label: "Índice Adiposo/Óseo",
              actual: (adipActual / oseaActual).toFixed(2),
              anterior: adipAnt !== null && oseaAnt !== null && oseaAnt !== 0
                ? (adipAnt / oseaAnt).toFixed(2) : null,
            })
          }
          if (adipActual !== null && muscActual !== null && muscActual !== 0) {
            indicesData.push({
              label: "Índice Adiposo/Muscular",
              actual: (adipActual / muscActual).toFixed(2),
              anterior: adipAnt !== null && muscAnt !== null && muscAnt !== 0
                ? (adipAnt / muscAnt).toFixed(2) : null,
            })
          }
          if (indicesData.length === 0) return null
          return (
            <>
              <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Índices</span>
              </div>
              {indicesData.map(({ label, actual, anterior }) => (
                <div key={label} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">{label}</span>
                  <span className="text-xs font-semibold tabular-nums w-10 text-right">{actual ?? "—"}</span>
                  <span className="text-xs italic text-red-400 tabular-nums w-10 text-right">{anterior ?? "—"}</span>
                </div>
              ))}
            </>
          )
        })()}
      </div>

      {/* Gráficos */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">Gráficos comparativos</h2>
        <div className="flex flex-col gap-4">
          <PesoChart peso={data.basicos.peso} />
          <DiffBarChart title="Brazos (cm)" rows={[
            ["Brazo Relajado", data.perimetros.brazoRelajado],
            [isMobile ? "Brazo Tensión" : "Brazo Flexionado en Tensión", data.perimetros.brazoFlexionado],
            ["Antebrazo", data.perimetros.antebrazo],
          ]} unit="cm" />
          <DiffBarChart title="Tronco (cm)" rows={[
            [isMobile ? "Tórax" : "Tórax Mesoesternal", data.perimetros.toraxMesoesternal],
            [isMobile ? "Cintura" : "Cintura (mínima)", data.perimetros.cintura],
            ["Caderas (máxima)", data.perimetros.caderas],
          ]} unit="cm" />
          <DiffBarChart title="Piernas (cm)" rows={[
            ["Muslo Sup.", data.perimetros.musloSuperior],
            ["Muslo Med.", data.perimetros.musloMedial],
            ["Pantorrilla", data.perimetros.pantorrillaMaxima],
          ]} unit="cm" />
          <DiffBarChart title="Pliegues (mm)" rows={pliegues} unit="mm" />
          <MasasChart masas={data.masas} />
        </div>
      </div>

    </div>
  )
}
