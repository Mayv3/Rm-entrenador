import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

import { supabase } from "@/lib/supabase-client"
import { THEME_COLOR_PATTERN } from "@/lib/theme-color"

const ACCEPTED_AVATAR_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
}
const MAX_AVATAR_SIZE = 2 * 1024 * 1024

export async function PATCH(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const email = token?.email
  if (!email) {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ message: "Datos inválidos." }, { status: 400 })
  }

  const themeColorRaw = formData.get("themeColor")
  const avatarFile = formData.get("avatar")

  const updates: { theme_color?: string; avatar_path?: string } = {}

  if (typeof themeColorRaw === "string" && themeColorRaw.length > 0) {
    if (!THEME_COLOR_PATTERN.test(themeColorRaw)) {
      return NextResponse.json({ message: "Color inválido." }, { status: 400 })
    }
    updates.theme_color = themeColorRaw.toUpperCase()
  }

  const { data: alumnoRows, error: findError } = await supabase
    .from("alumnos")
    .select("id, avatar_path")
    .ilike("email", email)

  if (findError || !alumnoRows?.length) {
    return NextResponse.json({ message: "Alumno no encontrado." }, { status: 404 })
  }
  const alumno = alumnoRows[0]

  if (avatarFile instanceof File) {
    const ext = ACCEPTED_AVATAR_TYPES[avatarFile.type]
    if (!ext) {
      return NextResponse.json({ message: "Formato de imagen no soportado." }, { status: 400 })
    }
    if (avatarFile.size > MAX_AVATAR_SIZE) {
      return NextResponse.json({ message: "La imagen es demasiado grande." }, { status: 400 })
    }

    const bytes = await avatarFile.arrayBuffer()
    const path = `${alumno.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(path, bytes, { contentType: avatarFile.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ message: "No se pudo subir la imagen." }, { status: 500 })
    }

    updates.avatar_path = path
    if (alumno.avatar_path) {
      await supabase.storage.from("profile-images").remove([alumno.avatar_path])
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "Nada para guardar." }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("alumnos")
    .update(updates)
    .eq("id", alumno.id)
    .select("id, theme_color, avatar_path")

  if (error || !data?.length) {
    return NextResponse.json({ message: "No se pudo guardar el perfil." }, { status: 500 })
  }

  return NextResponse.json({ theme_color: data[0].theme_color, avatar_path: data[0].avatar_path })
}
