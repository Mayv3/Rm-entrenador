"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { ArrowLeft, Dumbbell, CalendarDays } from "lucide-react"
import { Loader } from "@/components/ui/loader"
import { StudentPlanificacionSection } from "@/components/portal/student-planificacion-section"
import { ModeToggle } from "@/components/mode-toggle"
import { PlanCalendarioDialog } from "@/components/training-plans/plan-calendario-dialog"

interface Student {
  id: number
  nombre: string
  email: string
}

export default function MiPlanAppPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { setTheme } = useTheme()
  const themeInitRef = useRef(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  useEffect(() => {
    if (themeInitRef.current) return
    themeInitRef.current = true
    if (typeof window !== "undefined" && !localStorage.getItem("theme")) {
      setTheme("dark")
    }
  }, [setTheme])

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/portal/login")
  }, [status, router])

  const email = session?.user?.email ?? ""

  const { data: student, isLoading, isError, error: studentError } = useQuery({
    queryKey: ["portalStudent", email],
    queryFn: () =>
      axios
        .get<Student>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/student/by-email?email=${encodeURIComponent(email)}`)
        .then((r) => r.data),
    enabled: !!email,
    retry: (failureCount, err: any) => {
      const httpStatus = err?.response?.status
      if (httpStatus === 403 || httpStatus === 404) return false
      return failureCount < 2
    },
  })

  const { data: planData } = useQuery<{ planificacion: { id: number; nombre: string } | null }>({
    queryKey: ["portalPlanificacion", student?.id],
    queryFn: () =>
      axios
        .get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/portal/alumnos/${student!.id}/planificacion`)
        .then((r) => r.data),
    enabled: !!student?.id,
    staleTime: 60_000,
  })
  const planId = planData?.planificacion?.id ?? null

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-green-400 animate-pulse" />
          </div>
          <Loader />
        </div>
      </div>
    )
  }

  if ((studentError as any)?.response?.data?.code === "MEMBERSHIP_EXPIRED") {
    const msg =
      (studentError as any)?.response?.data?.message ??
      "Tu membresía venció hace más de un mes. Contactá a tu entrenador para reactivar tu acceso."
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background dark:bg-[#0a0a0a]">
        <div className="text-center space-y-3 max-w-xs">
          <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto ring-1 ring-red-500/30">
            <CalendarDays className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-base font-bold text-foreground dark:text-white">Membresía vencida</p>
          <p className="text-sm text-muted-foreground dark:text-zinc-400">{msg}</p>
          <a
            href="https://wa.me/543516671026"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow hover:bg-emerald-700 active:scale-[0.97] transition-all"
          >
            Contactar a mi entrenador
          </a>
        </div>
      </div>
    )
  }

  if (isError || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background dark:bg-[#0a0a0a]">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <Dumbbell className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-sm text-muted-foreground dark:text-zinc-400">No pudimos cargar tu cuenta.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background dark:bg-[#0a0a0a]">
      <header className="border-b border-border dark:border-white/[0.06] bg-background/80 dark:bg-background dark:bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground dark:text-zinc-500 hover:text-foreground dark:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              disabled={!planId}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border dark:border-white/10 bg-background dark:bg-white/[0.04] text-foreground dark:text-zinc-200 hover:bg-accent dark:hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Calendario de asistencias"
              title="Calendario de asistencias"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Dumbbell className="h-3.5 w-3.5 text-green-400" />
            </div>
            <span className="text-sm font-semibold text-foreground dark:text-white">Mi plan app</span>
          </div>
          <ModeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <StudentPlanificacionSection studentId={student.id} />
      </main>

      {planId && (
        <PlanCalendarioDialog
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
          planId={planId}
          alumnoNombre={student.nombre}
          alumnoId={student.id}
          calendarOnly
        />
      )}
    </div>
  )
}
