"use client"

import { useState, useRef } from "react"
import axios from "axios"
import { AntroView, ParsedAntro } from "@/components/antropometrias/antro-view"

export default function TestPdfPage() {
  const [data, setData] = useState<ParsedAntro | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setData(null)
    const form = new FormData()
    form.append("file", file)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_URL_BACKEND}/test-pdf`, form)
      setData(res.data)
    } catch {
      alert("Error al procesar el PDF")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-bold">Test PDF Parser</h1>

      <div
        className="border-2 border-dashed rounded-xl p-8 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="text-sm text-gray-500">{loading ? "Procesando..." : "Hacé clic o arrastrá un PDF"}</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "" }}
      />

      {data && <AntroView data={data} />}
    </div>
  )
}
