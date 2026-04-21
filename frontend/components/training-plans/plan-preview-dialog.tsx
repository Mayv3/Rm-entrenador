"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { CATEGORIA_COLORS, CATEGORIA_ROW_STYLE } from "@/types/planificaciones"
import type { Planificacion } from "@/types/planificaciones"

interface PlanPreviewDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  plan: Planificacion
}

const SEMANAS = [1, 2, 3, 4, 5, 6]

export function PlanPreviewDialog({ open, onOpenChange, plan }: PlanPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0">
          <h2 className="font-semibold text-base">{plan.nombre}</h2>
          {plan.alumnos && (
            <p className="text-xs text-muted-foreground mt-0.5">Alumno: {plan.alumnos.nombre}</p>
          )}
        </div>

        {/* Tabla scrolleable */}
        <div className="overflow-auto flex-1 p-4">
          {plan.hojas.flatMap((h) => h.dias).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              El plan no tiene días cargados.
            </p>
          ) : (
            <div className="space-y-10">
              {plan.hojas.map((hoja) => (
                <div key={hoja.id}>
                  {/* Título de la hoja */}
                  <h3 className="font-bold text-sm mb-3 uppercase tracking-wide text-muted-foreground">
                    {hoja.nombre}{hoja.estado === "completada" && " ✓"}
                  </h3>

                  <div className="space-y-8 mb-8">
                    {hoja.dias.map((dia) => (
                      <div key={dia.id}>
                        {/* Título del día */}
                        <table className="w-full border-collapse text-xs min-w-[700px]">
                          <thead>
                            {/* Fila título día */}
                            <tr>
                              <th
                                colSpan={2}
                                className="border border-gray-400 bg-gray-800 text-white text-left px-2 py-1.5 text-sm font-bold"
                              >
                                DÍA {dia.numero_dia} — {dia.nombre.toUpperCase()}
                              </th>
                              {SEMANAS.map((s) => (
                                <th
                                  key={s}
                                  colSpan={1}
                                  className="border border-gray-400 bg-gray-800 text-white text-center px-2 py-1.5 text-sm font-bold"
                                >
                                  SEMANA {s}
                                </th>
                              ))}
                            </tr>
                            {/* Fila cabecera columnas */}
                            <tr>
                              <th className="border border-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 text-left font-semibold w-36">
                                EJERCICIO
                              </th>
                              <th className="border border-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 text-left font-semibold w-16">
                                CAT.
                              </th>
                              {SEMANAS.map((s) => (
                                <th
                                  key={s}
                                  className="border border-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 text-center font-semibold"
                                >
                                  Dosis
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dia.ejercicios.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={2 + SEMANAS.length}
                                  className="border border-gray-300 px-3 py-3 text-center text-muted-foreground italic"
                                >
                                  Sin ejercicios
                                </td>
                              </tr>
                            ) : (
                              dia.ejercicios.map((ej) => {
                                const rowStyle = CATEGORIA_ROW_STYLE[ej.categoria]

                                return (
                                  <tr key={ej.id} style={rowStyle}>
                                    {/* Nombre */}
                                    <td className="border border-gray-300 px-2 py-2 font-medium align-middle">
                                      <div className="flex items-center gap-1.5">
                                        {ej.ejercicios.video_url && (
                                          <a
                                            href={ej.ejercicios.video_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-red-500 hover:text-red-600 shrink-0"
                                            title="Ver video"
                                          >
                                            ▶
                                          </a>
                                        )}
                                        <span className="leading-tight">{ej.ejercicios.nombre}</span>
                                      </div>
                                    </td>

                                    {/* Categoría */}
                                    <td className="border border-gray-300 px-2 py-2 text-center align-middle">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          CATEGORIA_COLORS[ej.categoria] ?? ""
                                        }`}
                                      >
                                        {ej.categoria}
                                      </span>
                                    </td>

                                    {/* Dosis por semana */}
                                    {SEMANAS.map((s) => {
                                      const semana = ej.semanas.find((sw) => sw.semana === s)
                                      return (
                                        <td
                                          key={s}
                                          className="border border-gray-300 px-2 py-2 text-center align-middle"
                                        >
                                          {semana?.dosis ? (
                                            <span className="font-medium text-[var(--primary-color)]">
                                              {semana.dosis}
                                            </span>
                                          ) : (
                                            <span className="text-gray-300 dark:text-gray-600">—</span>
                                          )}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
