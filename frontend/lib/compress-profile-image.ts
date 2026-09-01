const MAX_PROFILE_IMAGE_DIMENSION = 320
const PROFILE_IMAGE_QUALITY = 0.7
const MAX_SOURCE_SIZE = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export async function compressProfileImage(file: File): Promise<File> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Elegí una imagen JPG, PNG o WebP.")
  }

  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("La imagen original no puede superar los 10 MB.")
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_PROFILE_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    throw new Error("No se pudo procesar la imagen.")
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", PROFILE_IMAGE_QUALITY)
  })

  if (!blob) throw new Error("No se pudo comprimir la imagen.")

  return new File([blob], `perfil-${Date.now()}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  })
}
