"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import Image from "next/image"
import logoRodrigoEntrenador from "../../assets/LOGO-RODRIGO-VERDE.png"
import { Loader } from "@/components/ui/loader"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, LogOut, MessageSquare, ArrowLeft, Loader2, Download, Eye, TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { determineSubscriptionStatus, formatDate, getStatusColor } from "@/lib/payment-utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AntroView, ParsedAntro } from "@/components/antropometrias/antro-view"
import { AntroAnualChart } from "@/components/antropometrias/antro-anual-chart"

interface Student {
  id: number
  nombre: string
  modalidad: string
  dias: string
  fecha_de_nacimiento: string
  fecha_de_inicio: string
  ultima_antro: string
  email: string
  telefono: string
  plan: string
}

interface Payment {
  id: number
  alumno_id: number
  monto: number
  fecha_de_pago: string
  fecha_de_vencimiento: string
  modalidad: string
}

interface AntroRecord {
  id: number
  alumno_id: number
  nombre_archivo: string
  pdf_path: string
  created_at: string
}

function DaysSquares({ dias }: { dias: string }) {
  const diasStr = (dias || "").split(" - ")[0]
  const horario = (dias || "").split(" - ")[1] || ""
  const countMatch = diasStr.match(/^(\d+)\s*días?/)
  const count = countMatch
    ? parseInt(countMatch[1])
    : diasStr.split(",").filter((d) => d.trim()).length

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`flex-1 h-8 rounded-md border ${
              n <= count
                ? "bg-[var(--primary-color)] border-[var(--primary-color)]"
                : "bg-muted border-border"
            }`}
          />
        ))}
      </div>
      {horario && (
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? "día" : "días"} — {horario}
        </span>
      )}
    </div>
  )
}

function AntroViewDialog({ parsedData, antro, onClose }: { parsedData: ParsedAntro | null; antro: AntroRecord | null; onClose: () => void }) {
  async function handleView() {
    if (!antro) return
    const { data } = await supabase.storage.from("antropometrias").createSignedUrl(antro.pdf_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, "_blank")
  }

  async function handleDownload() {
    if (!antro) return
    const { data } = await supabase.storage.from("antropometrias").createSignedUrl(antro.pdf_path, 3600)
    if (!data?.signedUrl) return
    const blob = await fetch(data.signedUrl).then(r => r.blob())
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = antro.nombre_archivo
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={!!parsedData} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={handleDownload} className="h-8 gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Descargar
              </Button>
              <Button size="sm" variant="outline" onClick={handleView} className="h-8 gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Ver PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        {parsedData && <AntroView data={parsedData} />}
      </DialogContent>
    </Dialog>
  )
}

export default function PortalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme("dark")
    return () => setTheme("light")
  }, [setTheme])

  const [parsedData, setParsedData] = useState<ParsedAntro | null>(null)
  const [selectedAntro, setSelectedAntro] = useState<AntroRecord | null>(null)
  const [parsing, setParsing] = useState(false)
  const [showAnualChart, setShowAnualChart] = useState(false)

  async function handleSelectAntro(antro: AntroRecord) {
    setParsing(true)
    setSelectedAntro(antro)
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/antropometrias/${antro.id}/parsed`)
      setParsedData(res.data)
    } catch {
      alert("Error al procesar la antropometría")
      setSelectedAntro(null)
    } finally {
      setParsing(false)
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/portal/login")
  }, [status, router])

  const email = session?.user?.email ?? ""

  const { data: student, isLoading: loadingStudent, isError } = useQuery({
    queryKey: ["portalStudent", email],
    queryFn: () =>
      axios.get<Student>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/student/by-email?email=${encodeURIComponent(email)}`).then(r => r.data),
    enabled: !!email,
  })

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["portalPayments", student?.id],
    queryFn: () =>
      axios.get<Payment[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllPayments`).then(r =>
        r.data.filter(p => Number(p.alumno_id) === Number(student!.id))
      ),
    enabled: !!student?.id,
  })

  const { data: antros = [] } = useQuery<AntroRecord[]>({
    queryKey: ["portalAntros", student?.id],
    queryFn: () =>
      axios.get<AntroRecord[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${student!.id}/antropometrias`).then(r => r.data),
    enabled: !!student?.id,
  })

  const latestPayment = payments
    .sort((a, b) => new Date(b.fecha_de_pago).getTime() - new Date(a.fecha_de_pago).getTime())[0]

  const subscriptionStatus = latestPayment ? determineSubscriptionStatus(latestPayment) : "Indefinido"

  if (status === "loading" || loadingStudent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground text-sm">
          Tu cuenta de Gmail <strong>{email}</strong> no está registrada en el sistema.
        </p>
        <p className="text-xs text-muted-foreground">Contactá a tu entrenador para que te agregue.</p>
        <button onClick={() => signOut({ callbackUrl: "/portal/login" })} className="text-xs text-red-500 underline">
          Cerrar sesión
        </button>
      </div>
    )
  }

  if (!student) return null

  // Agrupar antros de a 4
  const antroGroups: AntroRecord[][] = []
  for (let i = 0; i < antros.length; i += 4) {
    antroGroups.push(antros.slice(i, i + 4))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between px-6 py-4">
          <Image src={logoRodrigoEntrenador} alt="RM Entrenador" width={100} />
          <button
            onClick={() => signOut({ callbackUrl: "/portal/login" })}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Perfil */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-bold text-2xl leading-tight">{student.nombre}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{student.email}</p>
          </div>
          <Badge
            className="shrink-0 mt-1 text-xs"
            style={{ backgroundColor: getStatusColor(subscriptionStatus) }}
          >
            {subscriptionStatus === "Pagado" ? "Activo" : subscriptionStatus === "Indefinido" ? "Indefinido" : "Inactivo"}
          </Badge>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="Plan" value={student.modalidad} />
          <InfoCard label="Inicio" value={formatDate(student.fecha_de_inicio)} />
          <InfoCard label="Nacimiento" value={formatDate(student.fecha_de_nacimiento)} />
          <InfoCard label="Última antrop." value={formatDate(student.ultima_antro)} />
        </div>

        {/* Días de entrenamiento */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Días de entrenamiento</span>
          <DaysSquares dias={student.dias} />
        </div>

        {/* Pago activo */}
        {latestPayment && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado de pago</span>
            <div className="rounded-lg border divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{latestPayment.modalidad}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Monto</span>
                <span className="font-medium">${Number(latestPayment.monto).toLocaleString("es-AR")}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Vencimiento</span>
                <span className="font-medium">{formatDate(latestPayment.fecha_de_vencimiento)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-3">
          <a
            href="https://wa.me/3516671026"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--primary-color)] text-white text-sm font-medium"
          >
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </a>
          {student.plan && (
            <a
              href={student.plan}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium"
            >
              <FileText className="h-4 w-4" />
              Mi plan
            </a>
          )}
        </div>

        {/* Antropometrías */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Mis antropometrías {antros.length > 0 && `(${antros.length})`}
            </span>
            {antros.length >= 2 && (
              <button
                onClick={() => setShowAnualChart(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary-color)] text-white text-xs font-semibold shadow-md hover:brightness-110 active:scale-95 transition-all"
              >
                <TrendingUp className="h-4 w-4" />
                Ver evolución
              </button>
            )}
          </div>

          {antros.length === 0 ? (
            <div className="rounded-lg border px-4 py-6 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Sin antropometrías cargadas</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {antroGroups.map((group, gi) => (
                <div key={gi} className="grid grid-cols-4 gap-2">
                  {group.map((antro) => (
                    <button
                      key={antro.id}
                      onClick={() => handleSelectAntro(antro)}
                      disabled={parsing}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-[var(--primary-color)]/5 border-[var(--primary-color)]/20 p-3 hover:bg-[var(--primary-color)]/10 hover:border-[var(--primary-color)]/40 transition-colors active:scale-95 disabled:opacity-50"
                    >
                      {parsing ? (
                        <Loader2 className="h-6 w-6 text-[var(--primary-color)] animate-spin" />
                      ) : (
                        <FileText className="h-6 w-6 text-[var(--primary-color)]" />
                      )}
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">
                        {format(new Date(antro.created_at), "d MMM yy", { locale: es })}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      <AntroViewDialog
        parsedData={parsedData}
        antro={selectedAntro}
        onClose={() => { setParsedData(null); setSelectedAntro(null) }}
      />

      <AntroAnualChart
        open={showAnualChart}
        onClose={() => setShowAnualChart(false)}
        antros={antros}
        onSelectAntro={handleSelectAntro}
        parsing={parsing}
      />
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium">{value || "No definido"}</span>
    </div>
  )
}
