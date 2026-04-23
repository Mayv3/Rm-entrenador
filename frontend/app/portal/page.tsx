"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import Image from "next/image"
import logoRodrigoEntrenador from "../../assets/LOGO-RODRIGO-VERDE.png"
import { Loader } from "@/components/ui/loader"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, LogOut, MessageSquare, ArrowLeft, Loader2, Download, Eye, TrendingUp, GitCompareArrows, Salad, Dumbbell, ArrowRight, X } from "lucide-react"
import { StudentPlanificacionSection } from "@/components/portal/student-planificacion-section"
import { supabase } from "@/lib/supabase-client"
import { determineSubscriptionStatus, formatDate, getStatusColor } from "@/lib/payment-utils"
import { usePlanes, Plan } from "@/hooks/use-planes"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AntroView, ParsedAntro } from "@/components/antropometrias/antro-view"
import { AntroAnualChart } from "@/components/antropometrias/antro-anual-chart"
import { AntroCompareDialog } from "@/components/antropometrias/antro-compare-dialog"

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
  habitos_link?: string | null
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
  fecha?: string
  habitos_link?: string | null
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
        {parsedData && antro && (
          <AntroView
            data={{ ...parsedData, fecha: format(new Date(antro.created_at), "dd/MM/yyyy", { locale: es }) }}
            hideScoreZ
          />
        )}
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
  const [parsingId, setParsingId] = useState<number | null>(null)
  const [showAnualChart, setShowAnualChart] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showPlanes, setShowPlanes] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null)
  const [showMiPlan, setShowMiPlan] = useState(false)
  const miPlanHistoryDepth = useRef(0)

  function closeMiPlan() {
    const depth = miPlanHistoryDepth.current
    if (depth > 0) history.go(-depth)
    setShowMiPlan(false)
  }

  async function handleSelectAntro(antro: AntroRecord) {
    setParsingId(antro.id)
    setSelectedAntro(antro)
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/antropometrias/${antro.id}/parsed`)
      setParsedData(res.data)
    } catch {
      alert("Error al procesar la antropometría")
      setSelectedAntro(null)
    } finally {
      setParsingId(null)
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

  const { data: planes = [] } = usePlanes()

  const { data: nutricionPdfs = [] } = useQuery<AntroRecord[]>({
    queryKey: ["portalNutricion", student?.id],
    queryFn: () =>
      axios.get<AntroRecord[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${student!.id}/nutricion`).then(r => r.data),
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
        <div>
          <h1 className="font-bold text-2xl leading-tight">{student.nombre}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{student.email}</p>
        </div>



        {/* Pago activo */}
        {latestPayment && (
          <div className="flex flex-col gap-2">
            <div className="rounded-2xl overflow-hidden border border-border bg-card">
              {/* Header */}
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: `${getStatusColor(subscriptionStatus)}15`, borderBottom: `1px solid ${getStatusColor(subscriptionStatus)}30` }}
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: getStatusColor(subscriptionStatus) }} />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Estado del plan</span>
                </div>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ color: getStatusColor(subscriptionStatus), backgroundColor: `${getStatusColor(subscriptionStatus)}20` }}
                >
                  {subscriptionStatus === "Pagado" ? "Activo" : subscriptionStatus === "Indefinido" ? "Indefinido" : "Inactivo"}
                </span>
              </div>
              {/* Body */}
              <div className="grid grid-cols-4 divide-x divide-border">
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-4">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Plan</span>
                  <span className="font-bold text-xs text-center">{latestPayment.modalidad}</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-4">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Precio</span>
                  <span className="font-bold text-xs" style={{ color: getStatusColor(subscriptionStatus) }}>
                    {(() => {
                      const planData = planes.find(p => p.nombre === latestPayment.modalidad)
                      return planData ? `$${Number(planData.precio).toLocaleString("es-AR")}` : `$${Number(latestPayment.monto).toLocaleString("es-AR")}`
                    })()}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-4">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Inicio</span>
                  <span className="font-bold text-xs text-center">{formatDate(student.fecha_de_inicio)}</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-4">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Vence</span>
                  <span className="font-bold text-xs text-center">{formatDate(latestPayment.fecha_de_vencimiento)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Planes disponibles */}
        <button
          onClick={() => setShowPlanes(true)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-4 flex items-center gap-3 hover:bg-muted/40 transition-colors active:scale-[0.98] text-left"
        >
          <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-[var(--primary-color)]/10 flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-[var(--primary-color)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Planes disponibles</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ver todos los planes</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {planes.slice(0, 5).map((p) => (
                <span
                  key={p.id}
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-0.5">
              Ver <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </button>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href="https://wa.me/543516671026"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--primary-color)] text-white text-sm font-medium"
          >
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </a>

          <button
            onClick={() => setShowMiPlan(true)}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium"
          >
            <Dumbbell className="h-4 w-4" />
            Mi plan app
          </button>

          {student.plan && (
            <a
              href={student.plan}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium"
            >
              <FileText className="h-4 w-4" />
              Mi plan PDF
            </a>
          )}
        </div>

        {/* Antropometrías */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Mis antropometrías {antros.length > 0 && `(${antros.length})`}
              </span>
              {student.ultima_antro && (
                <span className="text-xs text-muted-foreground">Última: {formatDate(student.ultima_antro)}</span>
              )}
            </div>
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
                      disabled={parsingId === antro.id}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-[var(--primary-color)]/5 border-[var(--primary-color)]/20 p-3 hover:bg-[var(--primary-color)]/10 hover:border-[var(--primary-color)]/40 transition-colors active:scale-95 disabled:opacity-50"
                    >
                      {parsingId === antro.id ? (
                        <Loader2 className="h-6 w-6 text-[var(--primary-color)] animate-spin" />
                      ) : (
                        <FileText className="h-6 w-6 text-[var(--primary-color)]" />
                      )}
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">
                        {(() => {
                          const raw = antro.fecha || antro.created_at
                          if (!raw) return "—"
                          const dateStr = raw.split("T")[0].split(" ")[0]
                          const [y, m, d] = dateStr.split("-").map(Number)
                          if (!y || !m || !d) return "—"
                          return format(new Date(y, m - 1, d), "d MMM yy", { locale: es })
                        })()}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowCompare(true)}
                  disabled={antros.length < 2}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  Comparar
                </button>
                {antros.length >= 2 && (
                  <button
                    onClick={() => setShowAnualChart(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary-color)] text-white text-xs font-semibold shadow-md hover:brightness-110 active:scale-95 transition-all"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    Ver evolución
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nutrición */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Nutrición {nutricionPdfs.length > 0 && `(${nutricionPdfs.length})`}
          </span>

          {nutricionPdfs.length === 0 ? (
            <div className="rounded-lg border px-4 py-6 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">Sin PDFs de nutrición cargados</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(() => {
                const groups: AntroRecord[][] = []
                for (let i = 0; i < nutricionPdfs.length; i += 4) groups.push(nutricionPdfs.slice(i, i + 4))
                return groups.map((group, gi) => (
                  <div key={gi} className="grid grid-cols-4 gap-2">
                    {group.map((pdf) => (
                      <button
                        key={pdf.id}
                        onClick={async () => {
                          const { data } = await supabase.storage.from("nutricion").createSignedUrl(pdf.pdf_path, 3600)
                          if (data?.signedUrl) window.open(data.signedUrl, "_blank")
                        }}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-[var(--primary-color)]/5 border-[var(--primary-color)]/20 p-3 hover:bg-[var(--primary-color)]/10 hover:border-[var(--primary-color)]/40 transition-colors active:scale-95"
                      >
                        <FileText className="h-6 w-6 text-[var(--primary-color)]" />
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">
                          {format(new Date(pdf.created_at), "d MMM yy", { locale: es })}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              })()}
            </div>
          )}
        </div>

        {/* Hábitos */}
        {student.habitos_link && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hábitos</span>
            <a
              href={student.habitos_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-4 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-colors active:scale-95 w-full"
            >
              <Salad className="h-7 w-7 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">Ver mis hábitos</span>
            </a>
          </div>
        )}

      </main>

      {/* Mi Plan Sidebar */}
      {showMiPlan && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => closeMiPlan()}
          />
          <div className="w-full max-w-md bg-[#0a0a0a] h-full flex flex-col animate-slide-in-right shadow-2xl border-l border-white/[0.06]">
            {/* Header */}
            <div className="border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl px-4 py-3.5 flex items-center justify-end flex-shrink-0">
              <button
                onClick={() => closeMiPlan()}
                className="h-8 w-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              {student && (
                <StudentPlanificacionSection
                  studentId={student.id}
                  onRequestClose={() => setShowMiPlan(false)}
                  historyDepthRef={miPlanHistoryDepth}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Planes disponibles */}
      <Dialog open={showPlanes} onOpenChange={setShowPlanes}>
        <DialogContent className="w-[90vw] !max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[var(--primary-color)]/10 flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-[var(--primary-color)]" />
            </div>
            <DialogTitle className="text-base font-bold">Planes disponibles</DialogTitle>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {planes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay planes cargados</p>
            ) : (
              planes.map((plan) => {
                const isExpanded = expandedPlan === plan.id
                return (
                  <button
                    key={plan.id}
                    onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                    className="relative rounded-2xl overflow-hidden border w-full text-left transition-all active:scale-[0.98]"
                    style={{ borderColor: `${plan.color ?? "#9e9e9e"}40` }}
                  >
                    {/* Barra de color izquierda */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                      style={{ backgroundColor: plan.color ?? "#9e9e9e" }}
                    />
                    {/* Header */}
                    <div
                      className="px-5 py-4 flex items-center justify-between"
                      style={{ backgroundColor: `${plan.color ?? "#9e9e9e"}0d` }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{plan.nombre}</span>
                        {plan.descripcion && (
                          <ArrowRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                        )}
                      </div>
                      <div
                        className="px-3 py-1.5 rounded-xl font-bold text-sm"
                        style={{
                          color: plan.color ?? "#9e9e9e",
                          backgroundColor: `${plan.color ?? "#9e9e9e"}20`,
                        }}
                      >
                        ${Number(plan.precio).toLocaleString("es-AR")}
                      </div>
                    </div>
                    {/* Descripción expandida */}
                    {isExpanded && plan.descripcion && (
                      <div
                        className="px-5 py-3 border-t text-xs text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_p]:mb-1 [&_br]:block"
                        style={{ borderColor: `${plan.color ?? "#9e9e9e"}30`, backgroundColor: `${plan.color ?? "#9e9e9e"}08` }}
                        dangerouslySetInnerHTML={{ __html: plan.descripcion }}
                      />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

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
        parsing={parsingId !== null}
      />

      <AntroCompareDialog
        open={showCompare}
        onClose={() => setShowCompare(false)}
        antros={antros}
      />
    </div>
  )
}

function InfoCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card px-4 py-3.5 flex flex-col gap-1 overflow-hidden">
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--primary-color)]" />
      )}
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-semibold truncate ${accent ? "text-[var(--primary-color)]" : ""}`}>
        {value || "No definido"}
      </span>
    </div>
  )
}
