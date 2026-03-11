"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

const PRIMARY_COLOR = "#22b567"

const COLORS = [
  // Rojos & Rosas
  "#F44336", "#E53935", "#D32F2F", "#C62828",
  "#E91E63", "#EC407A", "#F06292", "#AD1457",
  // Naranjas & Amarillos
  "#FF5722", "#FF7043", "#F4511E",
  "#FFC107", "#FFCA28", "#FFD54F", "#FBC02D",
  "#FFB300", "#FFA000",
  // Verdes
  PRIMARY_COLOR,
  "#4CAF50", "#43A047", "#66BB6A", "#81C784",
  "#2E7D32", "#388E3C", "#00C853", "#1B5E20",
  // Turquesas & Cian
  "#009688", "#26A69A", "#4DB6AC", "#00796B",
  "#00BCD4", "#26C6DA", "#4DD0E1", "#00838F",
  // Azules
  "#2196F3", "#1E88E5", "#42A5F5", "#64B5F6",
  "#1565C0", "#0D47A1",
  // Índigos & Violetas
  "#3F51B5", "#5C6BC0", "#7986CB",
  "#283593", "#1A237E",
  "#673AB7", "#7E57C2", "#9575CD",
  // Morados & Fucsias
  "#9C27B0", "#AB47BC", "#BA68C8",
  "#8E24AA", "#6A1B9A", "#D81B60",
  // Marrones & Neutros
  "#795548", "#8D6E63", "#A1887F",
  "#5D4037", "#3E2723",
  "#607D8B", "#78909C", "#90A4AE",
  // Oscuros
  "#263238", "#37474F", "#212121",
  "#1C1C1C", "#000000",
]

function getContrastColor(hex: string) {
  if (!hex) return "#000"
  const rgb = parseInt(hex.slice(1), 16)
  const r = (rgb >> 16) & 0xff
  const g = (rgb >> 8) & 0xff
  const b = rgb & 0xff
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140 ? "#fff" : "#000"
}

interface ColorPickerPopoverProps {
  value: string
  onChange: (color: string) => void
  label?: string
  height?: string
}

export function ColorPickerPopover({ value, onChange, label, height = "36px" }: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  console.log("render value:", value)

  // Click-outside con capture phase — no interfiere con Radix ni con z-index
  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("click", handleOutside, true) // capture: true
    return () => document.removeEventListener("click", handleOutside, true)
  }, [open])

  function handleSelect(c: string) {
    onChange(c)
    setOpen(false)
  }

  const textColor = value ? getContrastColor(value) : "#6b7280"

  return (
    <>
      <style>{`
        @keyframes primaryGlow {
          from { box-shadow: 0 0 3px 2px #22b56766; }
          to   { box-shadow: 0 0 10px 4px #22b567bb; }
        }
        .primary-glow { animation: primaryGlow 1.6s ease-in-out infinite alternate; }

        /* Anula cualquier transition de MUI u otras libs sobre este botón */
        .color-picker-trigger {
          transition: none !important;
          -webkit-transition: none !important;
        }
      `}</style>

      {/* El container crea su propio stacking context — el z-index lo lleva el contenedor, no el botón */}
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ zIndex: open ? 200 : "auto", isolation: "isolate" }}
      >
        {/* Trigger — sin z-index propio, sin transition */}
        <button
          type="button"
          className="color-picker-trigger w-full flex items-center justify-between gap-2 px-3 rounded-md border border-input text-sm font-medium"
          onClick={() => setOpen((v) => !v)}
          style={{
            height,
            // Forzamos repaint con una propiedad que el browser no puede ignorar
            backgroundColor: value || "transparent",
            color: textColor,
            borderColor: open ? PRIMARY_COLOR : undefined,
            // will-change le dice al browser que este valor cambia seguido → repinta siempre
            willChange: "background-color",
          }}
        >
          <span className="truncate">{label ?? value}</span>
          <ChevronDown
            className="h-4 w-4 flex-shrink-0"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }}
          />
        </button>

        {/* Panel flotante */}
        {open && (
          <div
            className="absolute left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-xl p-2 max-h-48 overflow-y-auto"
            style={{ zIndex: 1 }} // relativo al container que ya tiene z-index: 200
          >
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((c) => {
                const isPrimary = c.toLowerCase() === PRIMARY_COLOR.toLowerCase()
                const isSelected = value?.toLowerCase() === c.toLowerCase()
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={[
                      "color-picker-trigger aspect-square w-full rounded-full active:scale-90 transition-transform",
                      isPrimary && !isSelected ? "primary-glow" : "",
                    ].join(" ")}
                    style={{
                      backgroundColor: c,
                      outline: isSelected ? `3px solid ${c}` : "none",
                      outlineOffset: "2px",
                      boxShadow: isSelected && isPrimary ? `0 0 10px 4px ${PRIMARY_COLOR}bb` : undefined,
                    }}
                    aria-label={c}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
