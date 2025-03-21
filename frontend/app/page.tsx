import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StudentsTable } from "@/components/students-table"
import { PaymentsTable } from "@/components/payments-table"
import { DashboardHeader } from "@/components/dashboard-header"

export default function Dashboard() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <DashboardHeader />
      <main className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <Tabs defaultValue="students" className="space-y-4">
          <TabsList className="w-full flex flex-wrap h-auto">
            <TabsTrigger value="students" className="flex-1 text-xs sm:text-sm py-2">
              <span className="truncate">Seguimiento de Alumnos</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-1 text-xs sm:text-sm py-2">
              <span className="truncate">Registro de Pagos</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="students" className="space-y-4">
            <StudentsTable />
          </TabsContent>
          <TabsContent value="payments" className="space-y-4">
            <PaymentsTable />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

