"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { StudentPlanificacionSection } from "@/components/portal/student-planificacion-section"

function Inner() {
  const params = useSearchParams()
  const studentId = Number(params.get("studentId") ?? 1)
  return (
    <div className="min-h-screen bg-background p-4" data-testid="portal-test-root">
      <StudentPlanificacionSection studentId={studentId} />
    </div>
  )
}

export default function TestPortalPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_E2E !== "1") {
    return <div>Disabled in production.</div>
  }
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Inner />
    </Suspense>
  )
}
