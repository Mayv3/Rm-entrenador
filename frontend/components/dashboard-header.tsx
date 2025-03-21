import { Dumbbell } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-6 w-6" />
          <h1 className="text-xl font-bold">RM Entrenador</h1>
        </div>
      </div>
    </header>
  )
}

