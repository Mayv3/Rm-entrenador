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
import { FileText, LogOut, MessageSquare, ArrowLeft, Loader2, Download, Eye, TrendingUp, GitCompareArrows, Salad, Dumbbell, ArrowRight, X, CalendarDays } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { StudentPlanificacionSection } from "@/components/portal/student-planificacion-section"
import { SaveStatusIndicator } from "@/components/portal/save-status-indicator"
import { supabase } from "@/lib/supabase-client"
import { determineSubscriptionStatus, formatDate, getStatusColor } from "@/lib/payment-utils"
import { usePlanes, Plan } from "@/hooks/use-planes"
import { useServicios } from "@/hooks/use-servicios"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AntroView, ParsedAntro } from "@/components/antropometrias/antro-view"
import { AntroAnualChart } from "@/components/antropometrias/antro-anual-chart"
import { AntroCompareDialog } from "@/components/antropometrias/antro-compare-dialog"
import { PlanCalendarioDialog } from "@/components/training-plans/plan-calendario-dialog"

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
  const themeInitRef = useRef(false)

  useEffect(() => {
    if (themeInitRef.current) return
    themeInitRef.current = true
    if (typeof window !== "undefined" && !localStorage.getItem("theme")) {
      setTheme("dark")
    }
  }, [setTheme])

  const [parsedData, setParsedData] = useState<ParsedAntro | null>(null)
  const [selectedAntro, setSelectedAntro] = useState<AntroRecord | null>(null)
  const [parsingId, setParsingId] = useState<number | null>(null)
  const [showAnualChart, setShowAnualChart] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showPlanes, setShowPlanes] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null)
  const [showServicios, setShowServicios] = useState(false)
  const [expandedServicio, setExpandedServicio] = useState<number | null>(null)
  const [showMiPlan, setShowMiPlan] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
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
  const { data: servicios = [] } = useServicios()

  const { data: nutricionPdfs = [] } = useQuery<AntroRecord[]>({
    queryKey: ["portalNutricion", student?.id],
    queryFn: () =>
      axios.get<AntroRecord[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/clients/${student!.id}/nutricion`).then(r => r.data),
    enabled: !!student?.id,
  })

  const { data: appPlanResp, isLoading: loadingAppPlan, isFetching: fetchingAppPlan } = useQuery<{ planificacion: any | null }>({
    queryKey: ["portalAppPlan", student?.id],
    queryFn: () =>
      axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/alumnos/${student!.id}/planificacion`).then(r => r.data),
    enabled: !!student?.id,
  })
  const hasAppPlan = !!appPlanResp?.planificacion
  const appPlanChecked = !!student?.id && !loadingAppPlan && !fetchingAppPlan && appPlanResp !== undefined

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
          <div className="flex items-center gap-2">
            <ModeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/portal/login" })}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Resumen unificado: perfil + estado plan + planes disponibles */}
        <div className="rounded-xl overflow-hidden border border-[var(--primary-color)]/40 bg-card shadow-sm">
          {/* Perfil */}
          <div className="px-5 py-4 flex items-center gap-4 border-b border-border">
            <div className="h-12 w-12 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center ring-1 ring-[var(--primary-color)]/30 flex-shrink-0">
              <span className="text-lg font-black text-[var(--primary-color)]">
                {(student.nombre ?? "?").trim().charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--primary-color)]">Alumno</span>
              <h1 className="font-bold text-lg leading-tight truncate text-foreground">{student.nombre}</h1>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{student.email}</p>
            </div>
          </div>

          {/* Estado del plan */}
          {latestPayment && (
            <>
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ backgroundColor: `${getStatusColor(subscriptionStatus)}10`, borderBottom: `1px solid ${getStatusColor(subscriptionStatus)}25` }}
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: getStatusColor(subscriptionStatus) }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Estado del plan</span>
                </div>
                <span
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ color: getStatusColor(subscriptionStatus), backgroundColor: `${getStatusColor(subscriptionStatus)}20` }}
                >
                  {subscriptionStatus === "Pagado" ? "Activo" : subscriptionStatus === "Indefinido" ? "Indefinido" : "Inactivo"}
                </span>
              </div>
              <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
                <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-3">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Plan</span>
                  <span className="font-bold text-xs text-center">{latestPayment.modalidad}</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-3">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Precio</span>
                  <span className="font-bold text-xs" style={{ color: getStatusColor(subscriptionStatus) }}>
                    {(() => {
                      const planData = planes.find(p => p.nombre === latestPayment.modalidad)
                      return planData ? `$${Number(planData.precio).toLocaleString("es-AR")}` : `$${Number(latestPayment.monto).toLocaleString("es-AR")}`
                    })()}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-3">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Inicio</span>
                  <span className="font-bold text-xs text-center">{formatDate(student.fecha_de_inicio)}</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-3">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">Vence</span>
                  <span className="font-bold text-xs text-center">{formatDate(latestPayment.fecha_de_vencimiento)}</span>
                </div>
              </div>
            </>
          )}

          {/* Planes disponibles */}
          <button
            onClick={() => setShowPlanes(true)}
            className="group w-full px-5 py-3.5 flex items-center gap-3 hover:bg-muted/40 active:scale-[0.99] transition-all text-left border-b border-border"
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground">Planes disponibles</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ver todos los planes</p>
            </div>
            <ArrowRight className="h-5 w-5 text-[var(--primary-color)] transition-transform group-hover:translate-x-1" />
          </button>

          {/* Servicios disponibles */}
          <button
            onClick={() => setShowServicios(true)}
            className="group w-full px-5 py-3.5 flex items-center gap-3 hover:bg-muted/40 active:scale-[0.99] transition-all text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground">Servicios disponibles</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ver todos los servicios</p>
            </div>
            <ArrowRight className="h-5 w-5 text-[var(--primary-color)] transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Acciones — con fondo */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href="https://wa.me/543516671026"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden flex flex-col items-center justify-center gap-2 py-5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 border border-white/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center gap-1.5">
              <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold tracking-tight">WhatsApp</span>
              <span className="text-[10px] text-white/70 uppercase tracking-widest">Contactar</span>
            </div>
          </a>

          {!appPlanChecked ? (
            <div className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl bg-muted/40 border border-border select-none">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary-color)]" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Cargando…</span>
            </div>
          ) : hasAppPlan ? (
            <button
              onClick={() => setShowMiPlan(true)}
              className="group relative overflow-hidden flex flex-col items-center justify-center gap-2 py-5 rounded-xl bg-gradient-to-br from-[var(--primary-color)] to-[color-mix(in_srgb,var(--primary-color)_55%,black)] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 border border-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col items-center gap-1.5">
                <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold tracking-tight">Mi planificación</span>
                <span className="text-[10px] text-white/70 uppercase tracking-widest">Entrenar</span>
              </div>
            </button>
          ) : student.plan ? (
            <a
              href={student.plan}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden flex flex-col items-center justify-center gap-2 py-5 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 border border-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col items-center gap-1.5">
                <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                  <FileText className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold tracking-tight">Mi plan Excel</span>
                <span className="text-[10px] text-white/70 uppercase tracking-widest">Abrir hoja</span>
              </div>
            </a>
          ) : (
            <div
              aria-disabled="true"
              className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl bg-muted/40 border border-border opacity-50 cursor-not-allowed select-none"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-bold text-muted-foreground">Sin plan</span>
            </div>
          )}
        </div>

        {/* Separador grupo salud/datos */}
        <div className="pt-10 mt-8 border-t-2 border-border/80 dark:border-white/[0.08]">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground dark:text-zinc-500">Salud y seguimiento</p>
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
            <div
              aria-disabled="true"
              className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl bg-muted/40 border border-border opacity-60 select-none"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-bold text-muted-foreground">Sin antropometrías cargadas</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {antroGroups.map((group, gi) => (
                <div key={gi} className="grid grid-cols-4 gap-2">
                  {group.map((antro, idx) => {
                    const ordinal = antros.length - (gi * 4 + idx)
                    return (
                      <button
                        key={antro.id}
                        onClick={() => handleSelectAntro(antro)}
                        disabled={parsingId === antro.id}
                        className="group relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-card border border-[var(--primary-color)]/40 hover:border-[var(--primary-color)] hover:bg-muted/40 shadow-sm hover:shadow active:scale-[0.96] transition-all duration-200 disabled:opacity-50"
                      >
                        <span className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-[var(--primary-color)]/15 text-[var(--primary-color)] leading-none">
                          #{ordinal}
                        </span>
                        <div className="h-8 w-8 rounded-full bg-[var(--primary-color)]/10 ring-1 ring-[var(--primary-color)]/30 flex items-center justify-center">
                          {parsingId === antro.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[var(--primary-color)]" />
                          ) : (
                            <FileText className="h-4 w-4 text-[var(--primary-color)]" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-semibold text-center leading-tight">
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
                    )
                  })}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowCompare(true)}
                  disabled={antros.length < 2}
                  className="group flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-card border border-purple-500/40 hover:border-purple-500 hover:bg-muted/40 text-xs font-bold text-foreground shadow-sm hover:shadow active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="h-7 w-7 rounded-full bg-purple-500/10 ring-1 ring-purple-500/30 flex items-center justify-center">
                    <GitCompareArrows className="h-3.5 w-3.5 text-purple-600" />
                  </div>
                  <span>Comparar</span>
                </button>
                {antros.length >= 2 && (
                  <button
                    onClick={() => setShowAnualChart(true)}
                    className="group flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-card border border-[var(--primary-color)]/40 hover:border-[var(--primary-color)] hover:bg-muted/40 text-xs font-bold text-foreground shadow-sm hover:shadow active:scale-[0.97] transition-all duration-200"
                  >
                    <div className="h-7 w-7 rounded-full bg-[var(--primary-color)]/10 ring-1 ring-[var(--primary-color)]/30 flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5 text-[var(--primary-color)]" />
                    </div>
                    <span>Ver evolución</span>
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
            <div
              aria-disabled="true"
              className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl bg-muted/40 border border-border opacity-60 select-none"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-bold text-muted-foreground">Sin PDFs de nutrición cargados</span>
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
                        className="group flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-card border border-[var(--primary-color)]/40 hover:border-[var(--primary-color)] hover:bg-muted/40 shadow-sm hover:shadow active:scale-[0.96] transition-all duration-200"
                      >
                        <div className="h-8 w-8 rounded-full bg-[var(--primary-color)]/10 ring-1 ring-[var(--primary-color)]/30 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-[var(--primary-color)]" />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-semibold text-center leading-tight">
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
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hábitos</span>
          {student.habitos_link && /^https?:\/\//i.test(student.habitos_link.trim()) ? (
            <a
              href={student.habitos_link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center gap-2 py-5 rounded-xl bg-card border border-emerald-500/40 hover:border-emerald-500 hover:bg-muted/40 shadow-sm hover:shadow active:scale-[0.97] transition-all duration-200 w-full"
            >
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30 flex items-center justify-center">
                <Salad className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">Ver mis hábitos</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Abrir</span>
            </a>
          ) : (
            <div
              aria-disabled="true"
              className="flex flex-col items-center justify-center gap-2 py-5 rounded-xl bg-muted/40 border border-border opacity-60 cursor-not-allowed select-none w-full"
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Salad className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-bold text-muted-foreground">Sin hábitos cargados</span>
            </div>
          )}
        </div>

      </main>

      {/* Mi Plan Sidebar */}
      {showMiPlan && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => closeMiPlan()}
          />
          <div className="w-full max-w-md bg-background dark:bg-[#0a0a0a] h-full flex flex-col animate-slide-in-right shadow-2xl border-l border-border dark:border-white/[0.06]">
            {/* Header */}
            <div className="border-b border-border dark:border-white/[0.06] bg-background/80 dark:bg-background dark:bg-[#0a0a0a]/80 backdrop-blur-xl px-4 py-3.5 flex items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalendarOpen(true)}
                  disabled={!appPlanResp?.planificacion?.id}
                  className="h-8 w-8 rounded-xl bg-muted dark:bg-white/[0.05] hover:bg-accent dark:hover:bg-white/[0.08] flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Calendario de asistencias"
                  title="Calendario de asistencias"
                >
                  <CalendarDays className="h-4 w-4 text-muted-foreground dark:text-zinc-300" />
                </button>
                <SaveStatusIndicator />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <ModeToggle />
              <button
                onClick={() => closeMiPlan()}
                className="h-8 w-8 rounded-xl bg-muted dark:bg-white/[0.05] hover:bg-muted dark:bg-white/[0.08] flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground dark:text-zinc-400" />
              </button>
              </div>
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
            {student && appPlanResp?.planificacion?.id && (
              <PlanCalendarioDialog
                open={calendarOpen}
                onOpenChange={setCalendarOpen}
                planId={appPlanResp.planificacion.id}
                alumnoNombre={student.nombre}
                alumnoId={student.id}
                calendarOnly
              />
            )}
          </div>
        </div>
      )}

      {/* Modal Planes disponibles */}
      <Dialog open={showPlanes} onOpenChange={setShowPlanes}>
        <DialogContent className="w-[90vw] !max-w-[420px] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-xl bg-[var(--primary-color)]/10 flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-[var(--primary-color)]" />
            </div>
            <DialogTitle className="text-base font-bold">Planes disponibles</DialogTitle>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
            {planes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay planes cargados</p>
            ) : (
              (() => {
                const basePlans = planes.filter((p) => p.parent_id == null)
                const subplanMap = new Map<number, Plan[]>()
                for (const p of planes) {
                  if (p.parent_id != null) {
                    if (!subplanMap.has(p.parent_id)) subplanMap.set(p.parent_id, [])
                    subplanMap.get(p.parent_id)!.push(p)
                  }
                }
                return basePlans.map((plan) => {
                  const isExpanded = expandedPlan === plan.id
                  const variants = (subplanMap.get(plan.id) ?? []).sort((a, b) => (a.duracion_meses ?? 0) - (b.duracion_meses ?? 0))
                  const hasContent = !!plan.descripcion || variants.length > 0
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                      className="relative rounded-2xl overflow-hidden border w-full text-left transition-all active:scale-[0.98]"
                      style={{ borderColor: `${plan.color ?? "#9e9e9e"}40` }}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                        style={{ backgroundColor: plan.color ?? "#9e9e9e" }}
                      />
                      <div
                        className="px-5 py-4 flex items-center justify-between"
                        style={{ backgroundColor: `${plan.color ?? "#9e9e9e"}0d` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{plan.nombre}</span>
                          {hasContent && (
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
                      {isExpanded && (
                        <>
                          {variants.length > 0 && (
                            <div
                              className="px-3 py-3 border-t flex flex-col gap-2"
                              style={{ borderColor: `${plan.color ?? "#9e9e9e"}30`, backgroundColor: `${plan.color ?? "#9e9e9e"}08` }}
                            >
                              {variants.map((v) => (
                                <div
                                  key={v.id}
                                  className="flex items-center justify-between rounded-xl px-3 py-2 bg-background/40 border"
                                  style={{ borderColor: `${plan.color ?? "#9e9e9e"}25` }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold">
                                      {v.duracion_meses ? `${v.duracion_meses} meses` : v.nombre}
                                    </span>
                                    {v.descuento > 0 && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500">
                                        -{v.descuento}%
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className="text-xs font-bold"
                                    style={{ color: plan.color ?? "#9e9e9e" }}
                                  >
                                    ${Number(v.precio).toLocaleString("es-AR")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {plan.descripcion && (
                            <div
                              className="px-5 py-3 border-t text-xs text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_p]:mb-1 [&_br]:block"
                              style={{ borderColor: `${plan.color ?? "#9e9e9e"}30`, backgroundColor: `${plan.color ?? "#9e9e9e"}08` }}
                              dangerouslySetInnerHTML={{ __html: plan.descripcion }}
                            />
                          )}
                        </>
                      )}
                    </button>
                  )
                })
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Servicios disponibles */}
      <Dialog open={showServicios} onOpenChange={setShowServicios}>
        <DialogContent className="w-[90vw] !max-w-[420px] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-xl bg-[var(--primary-color)]/10 flex items-center justify-center">
              <Salad className="h-4 w-4 text-[var(--primary-color)]" />
            </div>
            <DialogTitle className="text-base font-bold">Servicios disponibles</DialogTitle>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
            {servicios.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay servicios cargados</p>
            ) : (
              servicios.map((s) => {
                const isExpanded = expandedServicio === s.id
                const hasContent = !!s.descripcion
                return (
                  <button
                    key={s.id}
                    onClick={() => setExpandedServicio(isExpanded ? null : s.id)}
                    className="relative rounded-2xl overflow-hidden border w-full text-left transition-all active:scale-[0.98]"
                    style={{ borderColor: `${s.color ?? "#9e9e9e"}40` }}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                      style={{ backgroundColor: s.color ?? "#9e9e9e" }}
                    />
                    <div
                      className="px-5 py-4 flex items-center justify-between"
                      style={{ backgroundColor: `${s.color ?? "#9e9e9e"}0d` }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{s.nombre}</span>
                        {hasContent && (
                          <ArrowRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                        )}
                      </div>
                      <div
                        className="px-3 py-1.5 rounded-xl font-bold text-sm"
                        style={{
                          color: s.color ?? "#9e9e9e",
                          backgroundColor: `${s.color ?? "#9e9e9e"}20`,
                        }}
                      >
                        ${Number(s.precio).toLocaleString("es-AR")}
                      </div>
                    </div>
                    {isExpanded && s.descripcion && (
                      <div
                        className="px-5 py-3 border-t text-xs text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_p]:mb-1 [&_br]:block"
                        style={{ borderColor: `${s.color ?? "#9e9e9e"}30`, backgroundColor: `${s.color ?? "#9e9e9e"}08` }}
                        dangerouslySetInnerHTML={{ __html: s.descripcion }}
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
