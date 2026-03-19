"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LineChart } from "@mui/x-charts/LineChart"
import axios from "axios"
import { ParsedAntro } from "./antro-view"
import { Loader2, TrendingUp, FileText } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface AntroRecord {
  id: number
  alumno_id: number
  nombre_archivo: string
  pdf_path: string
  created_at: string
}

interface Props {
  open: boolean
  onClose: () => void
  antros: AntroRecord[]
  onSelectAntro: (antro: AntroRecord) => void
  parsing: boolean
}

function parseVal(val: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(",", "."))
  return isNaN(n) ? null : n
}

const COLORS = [
  "#16a34a", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6",
]

function MultiLineChart({
  title,
  labels,
  series,
  unit,
}: {
  title: string
  labels: string[]
  series: { label: string; data: (number | null)[] }[]
  unit: string
}) {
  const activeSeries = series.filter(s => s.data.some(v => v !== null))
  if (activeSeries.length === 0) return null

  const manyLabels = labels.length > 4

  return (
    <div className="rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-center text-xs font-bold uppercase tracking-widest py-2 text-white">
        {title}
      </div>
      <LineChart
        xAxis={[{
          scaleType: "band",
          data: labels,
          tickLabelStyle: manyLabels
            ? { angle: -35, textAnchor: "end", fontSize: 9 }
            : { fontSize: 10 },
        }]}
        yAxis={[{ label: unit, labelStyle: { fontSize: 10 } }]}
        series={activeSeries.map((s, i) => ({
          data: s.data,
          label: s.label,
          color: COLORS[i % COLORS.length],
          valueFormatter: (v: number | null) => v !== null ? `${v} ${unit}` : "—",
          showMark: true,
          curve: "linear",
        }))}
        height={300}
        margin={{ left: 0, right: 20, top: 20, bottom: manyLabels ? 50 : 20 }}
        tooltip={{ trigger: "axis" }}
        sx={{ width: "100%" }}
      />
    </div>
  )
}

export function AntroAnualChart({ open, onClose, antros, onSelectAntro, parsing }: Props) {
  const years = [...new Set(antros.map(a => new Date(a.created_at).getFullYear()))].sort((a, b) => b - a)
  const [selectedYear, setSelectedYear] = useState<number>(years[0] ?? new Date().getFullYear())
  const [parsedMap, setParsedMap] = useState<Map<number, ParsedAntro>>(new Map())
  const [loading, setLoading] = useState(false)

  const yearAntros = antros
    .filter(a => new Date(a.created_at).getFullYear() === selectedYear)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const yearAntroIds = yearAntros.map(a => a.id).join(",")

  useEffect(() => {
    if (!open || yearAntros.length === 0) return
    const missing = yearAntros.filter(a => !parsedMap.has(a.id))
    if (missing.length === 0) return

    setLoading(true)
    Promise.all(
      missing.map(a =>
        axios
          .get<ParsedAntro>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/antropometrias/${a.id}/parsed`)
          .then(r => ({ id: a.id, data: r.data }))
          .catch(() => null)
      )
    ).then(results => {
      setParsedMap(prev => {
        const next = new Map(prev)
        results.forEach(r => { if (r) next.set(r.id, r.data) })
        return next
      })
    }).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, yearAntroIds])

  const labels = yearAntros.map(a =>
    format(new Date(a.created_at), "d MMM yy", { locale: es })
  )
  const parsed = yearAntros.map(a => parsedMap.get(a.id) ?? null)

  function ms(label: string, getter: (p: ParsedAntro) => string | null) {
    return { label, data: parsed.map(p => (p ? parseVal(getter(p)) : null)) }
  }

  const groups = [
    {
      title: "Peso (kg)",
      unit: "kg",
      series: [ms("Peso", p => p.basicos.peso.actual)],
    },
    {
      title: "Talla (cm)",
      unit: "cm",
      series: [
        ms("Talla", p => p.basicos.talla.actual),
        ms("Talla sentado", p => p.basicos.tallaSentado.actual),
      ],
    },
    {
      title: "Diámetros (cm)",
      unit: "cm",
      series: [
        ms("Biacromial", p => p.diametros.biacromial.actual),
        ms("Tórax Transverso", p => p.diametros.toraxTransverso.actual),
        ms("Tórax AP", p => p.diametros.toraxAnteroposterior.actual),
        ms("Bi-iliocrestídeo", p => p.diametros.biIliocrestideo.actual),
        ms("Humeral", p => p.diametros.humeralBiepicondilar.actual),
        ms("Femoral", p => p.diametros.femoralBiepicondilar.actual),
      ],
    },
    {
      title: "Perímetros Miembros Sup. (cm)",
      unit: "cm",
      series: [
        ms("Cabeza", p => p.perimetros.cabeza.actual),
        ms("Brazo Relajado", p => p.perimetros.brazoRelajado.actual),
        ms("Brazo Tensión", p => p.perimetros.brazoFlexionado.actual),
        ms("Antebrazo", p => p.perimetros.antebrazo.actual),
      ],
    },
    {
      title: "Perímetros Tronco (cm)",
      unit: "cm",
      series: [
        ms("Tórax", p => p.perimetros.toraxMesoesternal.actual),
        ms("Cintura", p => p.perimetros.cintura.actual),
        ms("Caderas", p => p.perimetros.caderas.actual),
      ],
    },
    {
      title: "Perímetros Miembros Inf. (cm)",
      unit: "cm",
      series: [
        ms("Muslo Sup.", p => p.perimetros.musloSuperior.actual),
        ms("Muslo Med.", p => p.perimetros.musloMedial.actual),
        ms("Pantorrilla", p => p.perimetros.pantorrillaMaxima.actual),
      ],
    },
    {
      title: "Pliegues (mm)",
      unit: "mm",
      series: [
        ms("Tríceps", p => p.pliegues.triceps.actual),
        ms("Subescapular", p => p.pliegues.subescapular.actual),
        ms("Supraespinal", p => p.pliegues.supraespinal.actual),
        ms("Abdominal", p => p.pliegues.abdominal.actual),
        ms("Muslo Med.", p => p.pliegues.musloMedial.actual),
        ms("Pantorrilla", p => p.pliegues.pantorrilla.actual),
      ],
    },
    {
      title: "Masas Corporales (kg)",
      unit: "kg",
      series: [
        ms("Adiposa", p => p.masas.adiposa.kgActual),
        ms("Muscular", p => p.masas.muscular.kgActual),
        ms("Residual", p => p.masas.residual.kgActual),
        ms("Ósea", p => p.masas.osea.kgActual),
        ms("Piel", p => p.masas.piel.kgActual),
      ],
    },
  ]

  const hasEnoughData = yearAntros.length >= 2

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Evolución anual
          </DialogTitle>
        </DialogHeader>

        {/* Filtro por año */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Año:</span>
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                y === selectedYear
                  ? "bg-[var(--primary-color)] text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 -mt-1">
          <p className="text-xs text-muted-foreground">
            {yearAntros.length} antropometría{yearAntros.length !== 1 ? "s" : ""} en {selectedYear}
          </p>
          {yearAntros.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {yearAntros.map(antro => (
                <button
                  key={antro.id}
                  onClick={() => onSelectAntro(antro)}
                  disabled={parsing}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-[var(--primary-color)]/5 border-[var(--primary-color)]/20 p-3 hover:bg-[var(--primary-color)]/10 hover:border-[var(--primary-color)]/40 transition-colors active:scale-95 disabled:opacity-50"
                >
                  {parsing ? (
                    <Loader2 className="h-6 w-6 text-[var(--primary-color)] animate-spin" />
                  ) : (
                    <FileText className="h-6 w-6 text-[var(--primary-color)]" />
                  )}
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {format(new Date(antro.created_at), "d MMM yy", { locale: es })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          </div>
        )}

        {!loading && !hasEnoughData && (
          <div className="rounded-lg border px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Se necesitan al menos 2 antropometrías en {selectedYear} para ver la evolución.
            </p>
          </div>
        )}

        {!loading && hasEnoughData && (
          <div className="flex flex-col gap-4">
            {groups.map(g => (
              <MultiLineChart
                key={g.title}
                title={g.title}
                labels={labels}
                series={g.series}
                unit={g.unit}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
