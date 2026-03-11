"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import Image from "next/image"
import logoRodrigoEntrenador from "../../assets/LOGO-RODRIGO-VERDE.png"
import { Loader } from "@/components/ui/loader"
import { Badge } from "@/components/ui/badge"
import { FileText, LogOut, MessageSquare } from "lucide-react"
import { determineSubscriptionStatus, formatDate, getStatusColor } from "@/lib/payment-utils"

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

export default function PortalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

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

  const days = [
    { label: "L", match: "Lun" },
    { label: "M", match: "Mar" },
    { label: "X", match: "Mié" },
    { label: "J", match: "Jue" },
    { label: "V", match: "Vie" },
    { label: "S", match: "Sáb" },
    { label: "D", match: "Dom" },
  ]

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

        {/* Días */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Días de entrenamiento</span>
          <div className="flex gap-1.5">
            {days.map(({ label, match }) => {
              const active = student.dias?.includes(match)
              return (
                <span
                  key={label}
                  className={`flex-1 flex items-center justify-center h-8 rounded-md text-xs font-semibold border ${
                    active
                      ? "bg-[var(--primary-color)] text-white border-[var(--primary-color)]"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {label}
                </span>
              )
            })}
          </div>
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
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mis antropometrías</span>
          <div className="rounded-lg border px-4 py-6 flex items-center justify-center">
            <span className="text-sm text-muted-foreground italic">Próximamente</span>
          </div>
        </div>

      </main>
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
