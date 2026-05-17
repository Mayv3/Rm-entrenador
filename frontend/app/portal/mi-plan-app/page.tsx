"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { ArrowLeft, Dumbbell } from "lucide-react"
import { Loader } from "@/components/ui/loader"
import { StudentPlanificacionSection } from "@/components/portal/student-planificacion-section"
import { ModeToggle } from "@/components/mode-toggle"

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

  const { data: student, isLoading, isError } = useQuery({
    queryKey: ["portalStudent", email],
    queryFn: () =>
      axios
        .get<Student>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/student/by-email?email=${encodeURIComponent(email)}`)
        .then((r) => r.data),
    enabled: !!email,
  })

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
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground dark:text-zinc-500 hover:text-foreground dark:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
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
    </div>
  )
}
