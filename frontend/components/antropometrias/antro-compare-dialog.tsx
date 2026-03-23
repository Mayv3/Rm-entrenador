"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BarChart } from "@mui/x-charts/BarChart"
import axios from "axios"
import { ParsedAntro } from "./antro-view"
import { Loader2, GitCompareArrows, FileText, X } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"

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
}

function parseVal(val: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(",", "."))
  return isNaN(n) ? null : n
}

function CompareBarChart({
  title,
  rows,
  labelA,
  labelB,
  unit = "",
}: {
  title: string
  rows: [string, number | null, number | null][]
  labelA: string
  labelB: string
  unit?: string
}) {
  const filtered = rows.filter(([, a, b]) => a !== null || b !== null)
  if (filtered.length === 0) return null

  const labels = filtered.map(([l]) => l)
  const dataA = filtered.map(([, a]) => a ?? 0)
  const dataB = filtered.map(([, , b]) => b ?? 0)
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
          tickLabelStyle: hasMany
            ? { angle: -35, textAnchor: "end", fontSize: 9 }
            : { fontSize: 10 },
        }]}
        yAxis={[{ label: unit, labelStyle: { fontSize: 10 } }]}
        series={[
          { data: dataA, label: labelA, color: "#16a34a", valueFormatter: (v) => `${v}${unit ? " " + unit : ""}` },
          { data: dataB, label: labelB, color: "#86efac", valueFormatter: (v) => `${v}${unit ? " " + unit : ""}` },
        ]}
        height={hasMany ? 320 : 280}
        margin={{ left: 0, right: 20, top: 20, bottom: hasMany ? 50 : 0 }}
        tooltip={{ trigger: "axis" }}
        borderRadius={8}
        sx={{ width: "100%" }}
      />
    </div>
  )
}

function CompareMasasChart({
  labelA,
  labelB,
  parsedA,
  parsedB,
}: {
  labelA: string
  labelB: string
  parsedA: ParsedAntro
  parsedB: ParsedAntro
}) {
  const rows: [string, number | null, number | null][] = [
    ["Adiposa", parseVal(parsedA.masas.adiposa.kgActual), parseVal(parsedB.masas.adiposa.kgActual)],
    ["Muscular", parseVal(parsedA.masas.muscular.kgActual), parseVal(parsedB.masas.muscular.kgActual)],
    ["Residual", parseVal(parsedA.masas.residual.kgActual), parseVal(parsedB.masas.residual.kgActual)],
    ["Ósea", parseVal(parsedA.masas.osea.kgActual), parseVal(parsedB.masas.osea.kgActual)],
  ]
  return (
    <CompareBarChart title="Masas Corporales (kg)" rows={rows} labelA={labelA} labelB={labelB} unit="kg" />
  )
}

export function AntroCompareDialog({ open, onClose, antros }: Props) {
  const [selA, setSelA] = useState<AntroRecord | null>(null)
  const [selB, setSelB] = useState<AntroRecord | null>(null)
  const [parsedA, setParsedA] = useState<ParsedAntro | null>(null)
  const [parsedB, setParsedB] = useState<ParsedAntro | null>(null)
  const [loading, setLoading] = useState(false)
  const [comparing, setComparing] = useState(false)

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setSelA(null)
      setSelB(null)
      setParsedA(null)
      setParsedB(null)
      setComparing(false)
    }
  }, [open])

  function handleSelect(antro: AntroRecord) {
    if (selA?.id === antro.id) { setSelA(null); return }
    if (selB?.id === antro.id) { setSelB(null); return }
    if (!selA) { setSelA(antro); return }
    if (!selB) { setSelB(antro); return }
    // Si ya hay 2, reemplazar el primero
    setSelA(selB)
    setSelB(antro)
  }

  async function handleCompare() {
    if (!selA || !selB) return
    setLoading(true)
    try {
      const [resA, resB] = await Promise.all([
        axios.get<ParsedAntro>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/antropometrias/${selA.id}/parsed`),
        axios.get<ParsedAntro>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/antropometrias/${selB.id}/parsed`),
      ])
      setParsedA(resA.data)
      setParsedB(resB.data)
      setComparing(true)
    } catch {
      alert("Error al cargar los datos de las antropometrías")
    } finally {
      setLoading(false)
    }
  }

  const labelA = selA ? format(new Date(selA.created_at), "d MMM yy", { locale: es }) : "A"
  const labelB = selB ? format(new Date(selB.created_at), "d MMM yy", { locale: es }) : "B"

  function buildRows(
    getter: (p: ParsedAntro) => (string | null),
    names: string[],
    getters: ((p: ParsedAntro) => string | null)[]
  ): [string, number | null, number | null][] {
    return names.map((name, i) => [
      name,
      parsedA ? parseVal(getters[i](parsedA)) : null,
      parsedB ? parseVal(getters[i](parsedB)) : null,
    ])
  }

  const sorted = [...antros].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {comparing ? (
              <button
                onClick={() => setComparing(false)}
                className="flex items-center gap-1 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Volver
              </button>
            ) : (
              <>
                <GitCompareArrows className="h-4 w-4 text-green-600" />
                Comparar antropometrías
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Selección ── */}
        {!comparing && (
          <div className="flex flex-col gap-4">
            {/* Chips seleccionados */}
            <div className="flex items-center gap-2 min-h-[32px]">
              {selA && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold">
                  <span className="w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">A</span>
                  {format(new Date(selA.created_at), "d MMM yy", { locale: es })}
                  <button onClick={() => setSelA(null)} className="ml-0.5 hover:text-green-900"><X className="h-3 w-3" /></button>
                </span>
              )}
              {selB && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs font-semibold">
                  <span className="w-4 h-4 rounded-full bg-[#86efac] text-green-900 flex items-center justify-center text-[9px] font-bold shrink-0">B</span>
                  {format(new Date(selB.created_at), "d MMM yy", { locale: es })}
                  <button onClick={() => setSelB(null)} className="ml-0.5 hover:text-blue-900"><X className="h-3 w-3" /></button>
                </span>
              )}
              {!selA && !selB && (
                <span className="text-xs text-muted-foreground">Seleccioná dos antropometrías para comparar</span>
              )}
              {selA && !selB && (
                <span className="text-xs text-muted-foreground">Seleccioná la segunda</span>
              )}
            </div>

            {/* Grid de antropometrías */}
            <div className="grid grid-cols-4 gap-2">
              {sorted.map((antro) => {
                const isA = selA?.id === antro.id
                const isB = selB?.id === antro.id
                return (
                  <button
                    key={antro.id}
                    onClick={() => handleSelect(antro)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 transition-all active:scale-95 relative ${
                      isA
                        ? "border-green-500 bg-green-50 dark:bg-green-900/30 ring-2 ring-green-500"
                        : isB
                        ? "border-green-300 bg-green-50 dark:bg-green-900/20 ring-2 ring-[#86efac]"
                        : "border-border bg-muted/30 hover:border-[var(--primary-color)]/50 hover:bg-[var(--primary-color)]/5"
                    }`}
                  >
                    {isA && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center text-[9px] font-bold">A</span>
                    )}
                    {isB && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#86efac] text-green-900 flex items-center justify-center text-[9px] font-bold">B</span>
                    )}
                    <FileText className={`h-6 w-6 ${isA ? "text-green-600" : isB ? "text-green-400" : "text-[var(--primary-color)]"}`} />
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {format(new Date(antro.created_at), "d MMM yy", { locale: es })}
                    </span>
                  </button>
                )
              })}
            </div>

            <Button
              className="bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
              disabled={!selA || !selB || loading}
              onClick={handleCompare}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cargando...</>
              ) : (
                <><GitCompareArrows className="h-4 w-4 mr-2" />Comparar</>
              )}
            </Button>
          </div>
        )}

        {/* ── Comparación ── */}
        {comparing && parsedA && parsedB && (
          <div className="flex flex-col gap-4">

            {/* Header con labels */}
            <div className="flex items-center justify-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-600 inline-block" />
                {labelA}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#86efac] inline-block" />
                {labelB}
              </span>
            </div>

            {/* Peso */}
            <CompareBarChart
              title="Peso (kg)"
              rows={[["Peso", parseVal(parsedA.basicos.peso.actual), parseVal(parsedB.basicos.peso.actual)]]}
              labelA={labelA}
              labelB={labelB}
              unit="kg"
            />

            {/* Básicos */}
            <CompareBarChart
              title="Básicos (cm)"
              rows={[
                ["Talla", parseVal(parsedA.basicos.talla.actual), parseVal(parsedB.basicos.talla.actual)],
                ["Talla Sentado", parseVal(parsedA.basicos.tallaSentado.actual), parseVal(parsedB.basicos.tallaSentado.actual)],
              ]}
              labelA={labelA}
              labelB={labelB}
              unit="cm"
            />

            {/* Diámetros */}
            <CompareBarChart
              title="Diámetros (cm)"
              rows={[
                ["Biacromial", parseVal(parsedA.diametros.biacromial.actual), parseVal(parsedB.diametros.biacromial.actual)],
                ["Tórax Trans.", parseVal(parsedA.diametros.toraxTransverso.actual), parseVal(parsedB.diametros.toraxTransverso.actual)],
                ["Tórax AP", parseVal(parsedA.diametros.toraxAnteroposterior.actual), parseVal(parsedB.diametros.toraxAnteroposterior.actual)],
                ["Bi-ilioc.", parseVal(parsedA.diametros.biIliocrestideo.actual), parseVal(parsedB.diametros.biIliocrestideo.actual)],
                ["Humeral", parseVal(parsedA.diametros.humeralBiepicondilar.actual), parseVal(parsedB.diametros.humeralBiepicondilar.actual)],
                ["Femoral", parseVal(parsedA.diametros.femoralBiepicondilar.actual), parseVal(parsedB.diametros.femoralBiepicondilar.actual)],
              ]}
              labelA={labelA}
              labelB={labelB}
              unit="cm"
            />

            {/* Perímetros brazos */}
            <CompareBarChart
              title="Perímetros Brazos (cm)"
              rows={[
                ["Br. Relajado", parseVal(parsedA.perimetros.brazoRelajado.actual), parseVal(parsedB.perimetros.brazoRelajado.actual)],
                ["Br. Tensión", parseVal(parsedA.perimetros.brazoFlexionado.actual), parseVal(parsedB.perimetros.brazoFlexionado.actual)],
                ["Antebrazo", parseVal(parsedA.perimetros.antebrazo.actual), parseVal(parsedB.perimetros.antebrazo.actual)],
              ]}
              labelA={labelA}
              labelB={labelB}
              unit="cm"
            />

            {/* Perímetros tronco */}
            <CompareBarChart
              title="Perímetros Tronco (cm)"
              rows={[
                ["Tórax", parseVal(parsedA.perimetros.toraxMesoesternal.actual), parseVal(parsedB.perimetros.toraxMesoesternal.actual)],
                ["Cintura", parseVal(parsedA.perimetros.cintura.actual), parseVal(parsedB.perimetros.cintura.actual)],
                ["Caderas", parseVal(parsedA.perimetros.caderas.actual), parseVal(parsedB.perimetros.caderas.actual)],
              ]}
              labelA={labelA}
              labelB={labelB}
              unit="cm"
            />

            {/* Perímetros piernas */}
            <CompareBarChart
              title="Perímetros Piernas (cm)"
              rows={[
                ["Muslo Sup.", parseVal(parsedA.perimetros.musloSuperior.actual), parseVal(parsedB.perimetros.musloSuperior.actual)],
                ["Muslo Med.", parseVal(parsedA.perimetros.musloMedial.actual), parseVal(parsedB.perimetros.musloMedial.actual)],
                ["Pantorrilla", parseVal(parsedA.perimetros.pantorrillaMaxima.actual), parseVal(parsedB.perimetros.pantorrillaMaxima.actual)],
              ]}
              labelA={labelA}
              labelB={labelB}
              unit="cm"
            />

            {/* Pliegues */}
            <CompareBarChart
              title="Pliegues (mm)"
              rows={[
                ["Tríceps", parseVal(parsedA.pliegues.triceps.actual), parseVal(parsedB.pliegues.triceps.actual)],
                ["Subescapular", parseVal(parsedA.pliegues.subescapular.actual), parseVal(parsedB.pliegues.subescapular.actual)],
                ["Supraespinal", parseVal(parsedA.pliegues.supraespinal.actual), parseVal(parsedB.pliegues.supraespinal.actual)],
                ["Abdominal", parseVal(parsedA.pliegues.abdominal.actual), parseVal(parsedB.pliegues.abdominal.actual)],
                ["Muslo Med.", parseVal(parsedA.pliegues.musloMedial.actual), parseVal(parsedB.pliegues.musloMedial.actual)],
                ["Pantorrilla", parseVal(parsedA.pliegues.pantorrilla.actual), parseVal(parsedB.pliegues.pantorrilla.actual)],
              ]}
              labelA={labelA}
              labelB={labelB}
              unit="mm"
            />

            {/* Masas */}
            <CompareMasasChart labelA={labelA} labelB={labelB} parsedA={parsedA} parsedB={parsedB} />

          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
