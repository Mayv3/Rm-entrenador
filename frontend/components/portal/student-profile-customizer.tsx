"use client"

import Image from "next/image"
import { ChangeEvent, useEffect, useState } from "react"
import { Loader2, Palette, Pencil, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ColorPicker } from "@/components/portal/color-picker"
import { compressProfileImage } from "@/lib/compress-profile-image"
import { supabase } from "@/lib/supabase-client"
import { DEFAULT_THEME_COLOR, THEME_COLOR_PATTERN } from "@/lib/theme-color"

const COLOR_PRESETS = ["#22B567", "#3B82F6", "#8B5CF6", "#F472B6", "#F97316", "#EAB308"]

interface StudentProfileCustomizerProps {
  student: {
    nombre: string
    theme_color?: string | null
    avatar_path?: string | null
  }
  disabled?: boolean
  onSaved: () => void | Promise<void>
}

function useSignedAvatarUrl(avatarPath?: string | null) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!avatarPath) {
      setUrl(null)
      return
    }
    supabase.storage
      .from("profile-images")
      .createSignedUrl(avatarPath, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [avatarPath])

  return url
}

export function StudentProfileCustomizer({ student, disabled = false, onSaved }: StudentProfileCustomizerProps) {
  const [open, setOpen] = useState(false)
  const [themeColor, setThemeColor] = useState(student.theme_color || DEFAULT_THEME_COLOR)
  const [compressedAvatar, setCompressedAvatar] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [error, setError] = useState("")
  const [customOpen, setCustomOpen] = useState(false)

  const savedAvatarUrl = useSignedAvatarUrl(student.avatar_path)
  const isPresetColor = COLOR_PRESETS.includes(themeColor.toUpperCase())

  useEffect(() => {
    setThemeColor(student.theme_color || DEFAULT_THEME_COLOR)
  }, [student.theme_color])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setCustomOpen(!COLOR_PRESETS.includes((student.theme_color || DEFAULT_THEME_COLOR).toUpperCase()))
    } else {
      setError("")
      setCompressedAvatar(null)
      setThemeColor(student.theme_color || DEFAULT_THEME_COLOR)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setProcessingImage(true)
    setError("")
    try {
      const compressed = await compressProfileImage(file)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setCompressedAvatar(compressed)
      setPreviewUrl(URL.createObjectURL(compressed))
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "No se pudo procesar la imagen.")
    } finally {
      setProcessingImage(false)
    }
  }

  async function handleSave() {
    if (!THEME_COLOR_PATTERN.test(themeColor)) {
      setError("Elegí un color válido.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("themeColor", themeColor.toUpperCase())
      if (compressedAvatar) formData.set("avatar", compressedAvatar)

      const response = await fetch("/api/portal/profile", {
        method: "PATCH",
        body: formData,
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.message || "No se pudo guardar el perfil.")
      }

      await onSaved()
      handleOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el perfil.")
    } finally {
      setSaving(false)
    }
  }

  const visibleAvatar = previewUrl || savedAvatarUrl

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        aria-label={disabled ? "Foto de perfil" : "Personalizar foto y color del perfil"}
        className="group relative h-12 w-12 flex-shrink-0 overflow-visible rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-offset-2 disabled:cursor-default"
      >
        <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-color)]/10 ring-1 ring-[var(--primary-color)]/30">
          {savedAvatarUrl ? (
            <Image src={savedAvatarUrl} alt={`Foto de ${student.nombre}`} fill sizes="48px" className="object-cover" unoptimized />
          ) : (
            <span className="text-lg font-black text-[var(--primary-color)]">
              {(student.nombre || "?").trim().charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        {!disabled && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-white shadow ring-2 ring-card transition-transform group-hover:scale-110">
            <Pencil className="h-2.5 w-2.5" />
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Personalizar mi perfil</DialogTitle>
            <DialogDescription>Elegí tu color y una foto para identificar tu espacio.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-2">
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full ring-4"
                style={{ backgroundColor: `${themeColor}20`, color: themeColor, boxShadow: `0 0 0 4px ${themeColor}55` }}
              >
                {visibleAvatar ? (
                  <Image src={visibleAvatar} alt="Vista previa de la foto" fill sizes="96px" className="object-cover" unoptimized />
                ) : (
                  <span className="text-3xl font-black">{(student.nombre || "?").trim().charAt(0).toUpperCase()}</span>
                )}
              </div>
              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                {processingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {processingImage ? "Comprimiendo..." : "Elegir imagen"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={processingImage || saving}
                  onChange={handleAvatarChange}
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Palette className="h-4 w-4" />
                Color del perfil
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Usar color ${color}`}
                    aria-pressed={themeColor.toUpperCase() === color}
                    onClick={() => setThemeColor(color)}
                    className="h-9 w-9 rounded-full border-2 border-background shadow ring-1 ring-border transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2"
                    style={{ backgroundColor: color }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setCustomOpen((o) => !o)}
                  aria-label="Elegir un color personalizado"
                  aria-pressed={customOpen || !isPresetColor}
                  title="Elegir otro color"
                  className="h-9 w-9 rounded-full border-2 border-background shadow ring-1 ring-border transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2"
                  style={{
                    background: isPresetColor
                      ? "conic-gradient(from 180deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
                      : themeColor,
                  }}
                />
              </div>
              {customOpen && <ColorPicker value={themeColor} onChange={setThemeColor} />}
            </div>

            {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || processingImage} style={{ backgroundColor: themeColor }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
