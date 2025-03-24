"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentsTable } from "@/components/students-table";
import { PaymentsTable } from "@/components/payments-table";
import { DashboardHeader } from "@/components/dashboard-header";

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <DashboardHeader />
      <main className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-tight">
            Panel de administración
          </h2>
        </div>
        <Tabs defaultValue="students" className="space-y-4 z-20">
          <TabsList className="w-full flex flex-wrap h-auto sticky top-20 bg-white shadow-md z-20">
            <TabsTrigger
              value="students"
              className="flex-1 text-xs sm:text-sm py-2 data-[state=active]:bg-[var(--primary-color)] data-[state=active]:text-white"
            >
              <span className="truncate">Seguimiento de Alumnos</span>
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="flex-1 text-xs sm:text-sm py-2 data-[state=active]:bg-[var(--primary-color)] data-[state=active]:text-white"
            >
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
  );
}