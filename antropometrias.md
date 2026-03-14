# Antropometrias — Plan de Implementación

## Resumen

Nueva sección en el dashboard que muestra cards de alumnos. Al hacer clic en una card se puede subir un PDF de antropometría. El PDF se guarda en Supabase Storage y el alumno lo puede ver desde su portal.

---

## 1. Setup en Supabase (hacer PRIMERO)

Tu proyecto Supabase es `iirvtjsmfzkmazewvaor` (el de RM-Entrenador, no FitFlow ni GYMSPACE).

### 1a. Crear el bucket de Storage

1. Ir a **Supabase Dashboard → Storage → New Bucket**
2. Nombre: `antropometrias`
3. Marcar como **privado** (no public) — los archivos se sirven con URLs firmadas
4. Guardar

### 1b. Configurar políticas RLS del bucket

En **Storage → Policies**, crear estas políticas para el bucket `antropometrias`:

**Para el admin (lectura, escritura, borrado):**
```sql
-- INSERT (subir archivos)
CREATE POLICY "Admin puede subir antropometrias"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'antropometrias');

-- SELECT (leer/descargar)
CREATE POLICY "Admin puede leer antropometrias"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'antropometrias');

-- DELETE (borrar)
CREATE POLICY "Admin puede borrar antropometrias"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'antropometrias');
```

> **Nota:** El proyecto usa la clave `publishable` (anon key) tanto en frontend como backend.
> Si en el futuro se agrega autenticación de admin por JWT, cambiar `TO anon` por `TO authenticated` y agregar validación de rol.

### 1c. Agregar columna en la tabla `alumnos`

Ejecutar en **Supabase → SQL Editor**:

```sql
ALTER TABLE alumnos
ADD COLUMN IF NOT EXISTS antro_pdf_path TEXT;
```

Esta columna va a guardar el path del archivo en el bucket, por ejemplo: `42/antro.pdf` (donde 42 es el id del alumno).

---

## 2. Estructura de archivos a crear/modificar

```
frontend/
├── components/
│   └── antropometrias/
│       ├── antropometrias-section.tsx     ← Componente principal (lista de cards)
│       └── antro-upload-dialog.tsx        ← Dialog para subir/ver el PDF
├── lib/
│   └── supabase-client.ts                 ← Cliente de Supabase para el frontend
└── app/
    └── dashboard/
        └── page.tsx                       ← Agregar tab "Antropometrias"
```

---

## 3. Implementación paso a paso

### Paso 1 — Crear cliente Supabase en el frontend

Crear `frontend/lib/supabase-client.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);
```

> El proyecto ya usa estas variables de entorno en el backend, solo hay que instalar `@supabase/supabase-js` en el frontend si no está instalado:
> ```bash
> cd frontend && npm install @supabase/supabase-js
> ```

### Paso 2 — Componente AntroUploadDialog

Crear `frontend/components/antropometrias/antro-upload-dialog.tsx`:

Funcionalidad:
- Recibe el alumno (id, nombre, antro_pdf_path)
- Si ya tiene PDF: muestra botón "Ver PDF" (abre URL firmada) + opción de reemplazar
- Si no tiene PDF: muestra zona de drag & drop para subir un PDF
- Al subir:
  1. Sube el archivo a `storage/antropometrias/{alumno_id}/antro.pdf`
  2. Guarda el path en `alumnos.antro_pdf_path`
  3. Invalida el query de alumnos para refrescar el badge en la card

```tsx
"use client"
import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase-client"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Upload, FileText, Trash2 } from "lucide-react"
import axios from "axios"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  alumno: { id: number; nombre: string; antro_pdf_path?: string }
}

export function AntroUploadDialog({ open, onOpenChange, alumno }: Props) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const bucketPath = `${alumno.id}/antro.pdf`

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") return alert("Solo se aceptan archivos PDF")
    setUploading(true)
    try {
      // 1. Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("antropometrias")
        .upload(bucketPath, file, { upsert: true })
      if (uploadError) throw uploadError

      // 2. Guardar path en la DB via backend
      await axios.put(
        `${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${alumno.id}`,
        { antro_pdf_path: bucketPath }
      )

      queryClient.invalidateQueries({ queryKey: queryKeys.students })
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      alert("Error al subir el archivo")
    } finally {
      setUploading(false)
    }
  }

  async function handleViewPdf() {
    const { data } = await supabase.storage
      .from("antropometrias")
      .createSignedUrl(alumno.antro_pdf_path!, 60 * 60) // URL válida 1 hora
    if (data?.signedUrl) window.open(data.signedUrl, "_blank")
  }

  async function handleDelete() {
    await supabase.storage.from("antropometrias").remove([bucketPath])
    await axios.put(`${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${alumno.id}`, {
      antro_pdf_path: null,
    })
    queryClient.invalidateQueries({ queryKey: queryKeys.students })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Antropometría — {alumno.nombre}</DialogTitle>
        </DialogHeader>

        {alumno.antro_pdf_path ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted">
              <FileText className="h-8 w-8 text-[var(--primary-color)]" />
              <span className="flex-1 text-sm font-medium">antro.pdf</span>
            </div>
            <Button onClick={handleViewPdf} className="bg-[var(--primary-color)] text-white">
              Ver PDF
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" /> Reemplazar PDF
            </Button>
            <Button variant="ghost" className="text-red-500" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
            </Button>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              dragOver ? "border-[var(--primary-color)] bg-[var(--primary-color)]/5" : "border-muted-foreground/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {uploading ? "Subiendo..." : "Arrastrá el PDF aquí o hacé clic para seleccionar"}
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </DialogContent>
    </Dialog>
  )
}
```

### Paso 3 — Componente AntropometriasSection

Crear `frontend/components/antropometrias/antropometrias-section.tsx`:

- Usa el mismo query de alumnos (`queryKeys.students`) que ya existe
- Muestra una grilla de cards simples
- Cada card muestra: nombre, badge si ya tiene PDF, botón para abrir el dialog

```tsx
"use client"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { queryKeys } from "@/lib/query-keys"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FileText, Search } from "lucide-react"
import { AntroUploadDialog } from "./antro-upload-dialog"
import { Loader } from "@/components/ui/loader"

export function AntropometriasSection() {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<any>(null)

  const { data: students = [], isLoading } = useQuery({
    queryKey: queryKeys.students,
    queryFn: async () => {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllStudents`)
      return res.data
    },
  })

  const filtered = students.filter((s: any) =>
    s.nombre?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <Loader />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar alumno..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map((alumno: any) => (
          <Card
            key={alumno.id}
            className="cursor-pointer hover:border-[var(--primary-color)] transition-colors"
            onClick={() => setSelected(alumno)}
          >
            <CardContent className="p-4 flex flex-col gap-2">
              <p className="text-sm font-medium leading-tight line-clamp-2">{alumno.nombre}</p>
              {alumno.antro_pdf_path ? (
                <Badge className="bg-[var(--primary-color)] text-white w-fit text-xs gap-1">
                  <FileText className="h-3 w-3" /> PDF
                </Badge>
              ) : (
                <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
                  Sin PDF
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selected && (
        <AntroUploadDialog
          open={!!selected}
          onOpenChange={(v) => !v && setSelected(null)}
          alumno={selected}
        />
      )}
    </div>
  )
}
```

### Paso 4 — Agregar tab en el Dashboard

En `frontend/app/dashboard/page.tsx`, hacer 4 cambios pequeños:

**Importar el componente:**
```tsx
import { AntropometriasSection } from "@/components/antropometrias/antropometrias-section"
```

**Importar el ícono (ya están los de lucide):**
```tsx
import { Users, CreditCard, Tag, LogOut, Moon, Sun, Globe, Copy, Check, Ruler } from "lucide-react"
// Ruler es el ícono para antropometría
```

**Agregar al tipo de activeTab:**
```tsx
const [activeTab, setActiveTab] = useState<"students" | "payments" | "planes" | "portal" | "antropometrias">("students");
```

**Agregar al array de navItems:**
```tsx
{ value: "antropometrias", label: "Antropometría", icon: Ruler },
```

**Agregar al render del contenido:**
```tsx
{activeTab === "students" ? <StudentsTable />
  : activeTab === "payments" ? <PaymentsTable />
  : activeTab === "planes" ? <PlanesTable />
  : activeTab === "antropometrias" ? <AntropometriasSection />
  : <PortalSection copied={copied} setCopied={setCopied} />}
```

### Paso 5 — Backend: soporte para `antro_pdf_path` en PUT /clients/:id

El endpoint `PUT /clients/:id` ya existe en `clientController`. Solo hay que asegurarse de que acepte y actualice el campo `antro_pdf_path`. Verificar en `backend/controllers/clientController.js` que el UPDATE no filtre este campo nuevo.

### Paso 6 — Portal del alumno: mostrar el PDF

En el portal del alumno (`/portal` page), agregar un botón "Ver Antropometría" que:
1. Llame a un endpoint del backend que genere una URL firmada para el alumno
2. Abra la URL en una nueva pestaña

**Nuevo endpoint en el backend:**
```js
// GET /antro-pdf/:alumnoId
app.get("/antro-pdf/:alumnoId", async (req, res) => {
  const { alumnoId } = req.params
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("antro_pdf_path")
    .eq("id", alumnoId)
    .single()

  if (!alumno?.antro_pdf_path) return res.status(404).json({ error: "Sin PDF" })

  const { data, error } = await supabase.storage
    .from("antropometrias")
    .createSignedUrl(alumno.antro_pdf_path, 60 * 60)

  if (error) return res.status(500).json({ error })
  res.json({ url: data.signedUrl })
})
```

---

## 4. Flujo de datos

```
Admin sube PDF
  → supabase.storage.upload("antropometrias/{id}/antro.pdf")
  → PUT /clients/{id} con antro_pdf_path = "{id}/antro.pdf"
  → DB alumnos.antro_pdf_path = "{id}/antro.pdf"

Admin ve PDF
  → supabase.storage.createSignedUrl(path, 3600)
  → window.open(signedUrl)

Alumno ve PDF desde portal
  → GET /antro-pdf/{id}
  → backend genera signedUrl
  → window.open(signedUrl)
```

---

## 5. Orden de ejecución

1. [ ] Crear bucket `antropometrias` en Supabase Dashboard
2. [ ] Crear las 3 políticas RLS en Storage
3. [ ] Ejecutar el ALTER TABLE para agregar `antro_pdf_path`
4. [ ] Instalar `@supabase/supabase-js` en el frontend (si no está)
5. [ ] Crear `frontend/lib/supabase-client.ts`
6. [ ] Crear `antro-upload-dialog.tsx`
7. [ ] Crear `antropometrias-section.tsx`
8. [ ] Modificar `dashboard/page.tsx` (4 cambios pequeños)
9. [ ] Verificar/modificar el backend PUT /clients/:id
10. [ ] (Opcional) Agregar endpoint GET /antro-pdf/:id y UI en el portal

---

## Notas

- **Un solo PDF por alumno**: se sobreescribe con `upsert: true`. Si en el futuro se quieren múltiples PDFs con historial, crear una tabla `antropometrias` separada.
- **Privacidad**: el bucket es privado, los archivos solo se sirven con URLs firmadas que expiran en 1 hora.
- **Mobile**: el grid de 2 columnas en mobile hace que las cards sean cómodas de tocar.
