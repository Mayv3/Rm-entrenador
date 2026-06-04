"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { queryKeys } from "@/lib/query-keys"
import { Plus, Loader2, Check, X, Settings2 } from "lucide-react"
import { TipoEjercicioManager } from "./tipo-ejercicio-manager"
import type { TipoEjercicio } from "@/types/planificaciones"

const NONE = "__none__"

interface TipoEjercicioSelectProps {
  /** Valor actual (grupo_muscular). "" = sin tipo */
  value: string
  onChange: (v: string) => void
  id?: string
  size?: "sm" | "default"
  placeholder?: string
  /** Mostrar opción "Sin tipo" (default true) */
  allowNone?: boolean
}

export function TipoEjercicioSelect({
  value,
  onChange,
  id,
  size = "default",
  placeholder = "Seleccionar tipo",
  allowNone = true,
}: TipoEjercicioSelectProps) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [nuevo, setNuevo] = useState("")
  const [saving, setSaving] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const { data: tipos = [] } = useQuery<TipoEjercicio[]>({
    queryKey: queryKeys.tiposEjercicio,
    queryFn: async () => (await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/tipos-ejercicio`)).data,
  })

  const h = size === "sm" ? "h-8" : "h-10"
  const nombres = tipos.map((t) => t.nombre)
  // Si el valor actual no existe en la lista (tipo heredado), lo agregamos como opción huérfana
  const opciones = value && !nombres.includes(value) ? [value, ...nombres] : nombres

  const handleAdd = async () => {
    const nombre = nuevo.trim()
    if (!nombre) return
    setSaving(true)
    try {
      const { data } = await axios.post<TipoEjercicio>(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/tipos-ejercicio`,
        { nombre }
      )
      await queryClient.invalidateQueries({ queryKey: queryKeys.tiposEjercicio })
      onChange(data.nombre) // auto-selecciona el tipo creado (nombre canónico)
      setNuevo("")
      setAdding(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {adding ? (
      <div className="flex items-center gap-1.5">
        <Input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleAdd() }
            if (e.key === "Escape") { setAdding(false); setNuevo("") }
          }}
          placeholder="Nuevo tipo (ej: EMPUJE)"
          className={`${h} text-sm`}
          autoFocus
        />
        <Button
          type="button"
          size="icon"
          className={`${h} w-9 shrink-0 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white`}
          onClick={handleAdd}
          disabled={saving || !nuevo.trim()}
          title="Guardar tipo"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={`${h} w-9 shrink-0`}
          onClick={() => { setAdding(false); setNuevo("") }}
          title="Cancelar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      ) : (
      <div className="flex items-center gap-1.5">
      <Select value={value} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger id={id} className={`${h} text-sm`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE}>Sin tipo</SelectItem>}
          {opciones.map((nombre) => (
            <SelectItem key={nombre} value={nombre}>{nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={`${h} w-9 shrink-0`}
        title="Agregar tipo de ejercicio"
        onClick={() => setAdding(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={`${h} w-9 shrink-0`}
        title="Editar o eliminar tipos"
        onClick={() => setManageOpen(true)}
      >
        <Settings2 className="h-4 w-4" />
      </Button>
      </div>
      )}
      <TipoEjercicioManager open={manageOpen} onOpenChange={setManageOpen} />
    </>
  )
}
