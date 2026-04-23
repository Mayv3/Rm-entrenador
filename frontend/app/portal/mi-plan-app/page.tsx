"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { ArrowLeft } from "lucide-react"
import { Loader } from "@/components/ui/loader"
import { StudentPlanificacionSection } from "@/components/portal/student-planificacion-section"

interface Student {
  id: number
  nombre: string
  email: string
}

export default function MiPlanAppPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme("dark")
    return () => setTheme("light")
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  if (isError || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">No pudimos cargar tu cuenta para abrir Mi plan app.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-4">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <span className="text-sm font-semibold">Mi plan app</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <StudentPlanificacionSection studentId={student.id} />
      </main>
    </div>
  )
}
