"use client"

import { useEffect, useRef, useState } from "react"

import { hexToHsv, hsvToHex, THEME_COLOR_PATTERN, type Hsv } from "@/lib/theme-color"

interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))
  const [hexInput, setHexInput] = useState(value.toUpperCase())
  const areaRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.toUpperCase() === hexInput.toUpperCase()) return
    setHsv(hexToHsv(value))
    setHexInput(value.toUpperCase())
  }, [value])

  function emit(next: Hsv) {
    setHsv(next)
    const hex = hsvToHex(next.h, next.s, next.v)
    setHexInput(hex)
    onChange(hex)
  }

  function pointToSv(clientX: number, clientY: number) {
    const rect = areaRef.current!.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height)
    emit({ h: hsv.h, s: (x / rect.width) * 100, v: 100 - (y / rect.height) * 100 })
  }

  function pointToHue(clientX: number) {
    const rect = hueRef.current!.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
    emit({ ...hsv, h: (x / rect.width) * 360 })
  }

  function handleHexInput(raw: string) {
    const next = raw.startsWith("#") ? raw : `#${raw}`
    setHexInput(next.toUpperCase())
    if (THEME_COLOR_PATTERN.test(next)) {
      setHsv(hexToHsv(next))
      onChange(next.toUpperCase())
    }
  }

  return (
    <div className="space-y-3">
      <div
        ref={areaRef}
        className="relative h-32 w-full touch-none rounded-lg"
        style={{
          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pointToSv(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return
          pointToSv(e.clientX, e.clientY)
        }}
      >
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/20"
          style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: hexInput }}
        />
      </div>

      <div
        ref={hueRef}
        className="relative h-3 w-full touch-none rounded-full"
        style={{
          backgroundImage:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pointToHue(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return
          pointToHue(e.clientX)
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow ring-1 ring-black/20"
          style={{ left: `${(hsv.h / 360) * 100}%` }}
        />
      </div>

      <input
        type="text"
        value={hexInput}
        onChange={(e) => handleHexInput(e.target.value)}
        maxLength={7}
        spellCheck={false}
        placeholder="#22B567"
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-mono uppercase tracking-wide focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  )
}
