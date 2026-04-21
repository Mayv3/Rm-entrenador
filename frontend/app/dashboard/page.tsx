"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StudentsTable } from "@/components/students/students-table";
import { PaymentsTable } from "@/components/payments/payments-table";
import { PlanesTable } from "@/components/planes/planes-table";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import logoRodrigoEntrenador from "../../assets/LOGO-RODRIGO-VERDE.png";
import { Users, CreditCard, Tag, LogOut, Moon, Sun, Globe, Copy, Check, Ruler, Salad, BarChart2, ClipboardList } from "lucide-react";
import { AntropometriasSection } from "@/components/antropometrias/antropometrias-section";
import { NutricionSection } from "@/components/nutricion/nutricion-section";
import { EstadisticasSection } from "@/components/estadisticas/estadisticas-section";
import { PlanificacionesSection } from "@/components/training-plans/planificaciones-section";
import { useTheme } from "next-themes";

function PortalSection({ copied, setCopied }: { copied: boolean; setCopied: (v: boolean) => void }) {
  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/portal/login` : "/portal/login"

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [portalUrl, setCopied])

  return (
    <div className="max-w-lg mx-auto mt-6 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Portal de Alumnos</h2>
        <p className="text-sm text-muted-foreground">
          Compartí este link con tus alumnos para que ingresen al portal.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Link de acceso</span>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono flex-1 truncate">{portalUrl}</span>
              <button
                onClick={handleCopy}
                className="shrink-0 p-1.5 rounded-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cómo funciona</span>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>El alumno entra al link y hace clic en <strong className="text-foreground">Ingresar con Gmail</strong></li>
              <li>Se autentica con su cuenta de Google</li>
              <li>Accede a su información personal y planes</li>
            </ol>
          </div>

          <Button
            size="sm"
            className="w-full bg-[var(--primary-color)] hover:bg-[var(--primary-color)]/90 text-white"
            onClick={() => window.open(portalUrl, "_blank")}
          >
            <Globe className="h-4 w-4 mr-2" />
            Abrir portal
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"students" | "payments" | "planes" | "portal" | "antropometrias" | "nutricion" | "estadisticas" | "planificaciones">("students");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (!isAuthenticated) {
      router.push("/landing.html");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    router.push("/landing.html");
  };

  const navItems = [
    { value: "estadisticas", label: "Estadísticas", icon: BarChart2 },
    { value: "students", label: "Alumnos", icon: Users },
    { value: "payments", label: "Pagos", icon: CreditCard },
    { value: "planes", label: "Planes", icon: Tag },
    { value: "portal", label: "Portal", icon: Globe },
    { value: "antropometrias", label: "Antropometría", icon: Ruler },
    { value: "nutricion", label: "Nutrición", icon: Salad },
    { value: "planificaciones", label: "Planificaciones", icon: ClipboardList },
  ] as const;

  return (
    <div className="flex min-h-screen">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex w-52 flex-col fixed left-0 top-0 h-full border-r bg-background z-30">
        <div className="flex items-center justify-center p-5 border-b">
          <Image src={logoRodrigoEntrenador} alt="Logo" width={110} />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === value
                  ? "bg-[var(--primary-color)] text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* ── Header mobile ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30">
        <DashboardHeader />
      </div>

      {/* ── Contenido principal ── */}
      <main className={`flex-1 md:ml-52 p-4 sm:p-6 mt-16 md:mt-0 pb-20 md:pb-0 overflow-x-hidden ${activeTab === "planificaciones" ? "md:overflow-y-hidden md:h-screen" : ""}`}>
        {/* Contenido */}
        <div className={`w-full md:max-w-[85vw] md:mx-auto ${activeTab === "planificaciones" ? "" : "space-y-4"}`}>
          {activeTab === "students" ? <StudentsTable />
            : activeTab === "payments" ? <PaymentsTable />
              : activeTab === "planes" ? <PlanesTable />
                : activeTab === "antropometrias" ? <AntropometriasSection />
                  : activeTab === "nutricion" ? <NutricionSection />
                    : activeTab === "estadisticas" ? <EstadisticasSection />
                    : activeTab === "planificaciones" ? <PlanificacionesSection />
                      : <PortalSection copied={copied} setCopied={setCopied} />
          }
        </div>
      </main>

      {/* ── Bottom nav mobile ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background border-t flex overflow-x-auto scrollbar-none">
        {navItems.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`flex-none flex flex-col items-center justify-center py-3 gap-1 px-4 min-w-[72px] transition-colors ${activeTab === value
                ? "text-[var(--primary-color)]"
                : "text-muted-foreground"
              }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[9px] font-medium whitespace-nowrap">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
