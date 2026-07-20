"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StudentsTable } from "@/components/students/students-table";
import { PaymentsTable } from "@/components/payments/payments-table";
import { PlanesTable } from "@/components/planes/planes-table";
import { ServiciosTable } from "@/components/servicios/servicios-table";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import logoRodrigoEntrenador from "../../assets/LOGO-RODRIGO-VERDE.png";
import { Users, CreditCard, Tag, LogOut, Moon, Sun, Globe, Copy, Check, Ruler, Salad, BarChart2, ClipboardList, HeartPulse, CalendarDays } from "lucide-react";
import { HoySection } from "@/components/hoy/hoy-section";
import { AntropometriasSection } from "@/components/antropometrias/antropometrias-section";
import { NutricionSection } from "@/components/nutricion/nutricion-section";
import { EstadisticasSection } from "@/components/estadisticas/estadisticas-section";
import { PlanificacionesSection } from "@/components/training-plans/planificaciones-section";
import { BackGuard } from "@/components/back-guard";
import { useTheme } from "next-themes";

function PortalSection({ copied, setCopied }: { copied: boolean; setCopied: (v: boolean) => void }) {
  const [portalUrl, setPortalUrl] = useState("/portal/login");

  useEffect(() => {
    setPortalUrl(`${window.location.origin}/portal/login`);
  }, []);

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
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"students" | "payments" | "planes" | "servicios" | "portal" | "antropometrias" | "nutricion" | "estadisticas" | "planificaciones" | "hoy">("students");
  const [copied, setCopied] = useState(false);
  const [alumnoFilter, setAlumnoFilter] = useState<string | null>(null);

  // "Plan App" desde Alumnos: aterriza en la lista de planificaciones filtrada por el alumno,
  // sin abrir el builder automáticamente.
  const handleOpenPlan = (alumnoNombre: string) => {
    setAlumnoFilter(alumnoNombre);
    setActiveTab("planificaciones");
  };

  useEffect(() => setMounted(true), []);

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
    { value: "hoy", label: "Hoy", icon: CalendarDays },
    { value: "estadisticas", label: "Estadísticas", icon: BarChart2 },
    { value: "students", label: "Alumnos", icon: Users },
    { value: "payments", label: "Pagos", icon: CreditCard },
    { value: "planificaciones", label: "Planificaciones", icon: ClipboardList },
    { value: "antropometrias", label: "Antropometría", icon: Ruler },
    { value: "nutricion", label: "Nutrición", icon: Salad },
    { value: "planes", label: "Planes", icon: Tag },
    { value: "servicios", label: "Servicios", icon: HeartPulse },
    { value: "portal", label: "Portal", icon: Globe },
  ] as const;

  return (
    <div className="flex min-h-screen">
      <BackGuard />

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex w-16 hover:w-60 flex-col fixed left-0 top-0 h-full border-r bg-card/80 backdrop-blur-xl z-30 transition-[width] duration-300 ease-smooth overflow-hidden group/sidebar shadow-premium">
        {/* Logo */}
        <div className="flex items-center border-b h-16 shrink-0 overflow-hidden">
          <span className="flex items-center justify-center w-16 shrink-0 group-hover/sidebar:opacity-0 group-hover/sidebar:w-0 transition-all duration-150">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-brand-glow font-bold text-sm">RM</span>
          </span>
          <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75 flex items-center justify-center flex-1 px-4">
            <Image src={logoRodrigoEntrenador} alt="Logo" width={120} />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-hidden">
          {navItems.map(({ value, label, icon: Icon }) => {
            const active = activeTab === value
            return (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`relative w-full flex items-center py-2.5 rounded-xl font-medium transition-all duration-200 ${active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary" />}
                <span className="flex items-center justify-center w-10 shrink-0">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-left text-sm whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75">
                  {label}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t space-y-1 shrink-0">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center py-2.5 rounded-xl font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
          >
            <span className="flex items-center justify-center w-10 shrink-0">
              {mounted && theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </span>
            <span className="flex-1 text-left text-sm whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75">
              {mounted && theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center py-2.5 rounded-xl font-medium text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-all duration-200"
          >
            <span className="flex items-center justify-center w-10 shrink-0">
              <LogOut className="h-[18px] w-[18px]" />
            </span>
            <span className="flex-1 text-left text-sm whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75">
              Cerrar Sesión
            </span>
          </button>
        </div>
      </aside>

      {/* ── Header mobile ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30">
        <DashboardHeader />
      </div>

      {/* ── Contenido principal ── */}
      <main className={`flex-1 md:ml-16 mt-16 md:mt-0 pb-20 md:pb-0 overflow-x-hidden ${activeTab === "planificaciones" ? "p-2 sm:p-3 md:overflow-y-auto md:h-screen" : "p-4 sm:p-6"}`}>
        {/* Contenido */}
        <div className={`w-full md:mx-auto ${activeTab === "planificaciones" ? "md:h-full md:max-w-[78vw]" : "md:max-w-[95vw] space-y-4"}`}>
          {activeTab === "students" ? <StudentsTable onOpenPlan={handleOpenPlan} />
            : activeTab === "hoy" ? <HoySection />
            : activeTab === "payments" ? <PaymentsTable />
              : activeTab === "planes" ? <PlanesTable />
                : activeTab === "servicios" ? <ServiciosTable />
                  : activeTab === "antropometrias" ? <AntropometriasSection />
                    : activeTab === "nutricion" ? <NutricionSection />
                      : activeTab === "estadisticas" ? <EstadisticasSection />
                        : activeTab === "planificaciones" ? <PlanificacionesSection initialSearch={alumnoFilter} />
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
            className={`relative flex-none flex flex-col items-center justify-center py-3 gap-1 px-4 min-w-[72px] transition-colors ${activeTab === value
              ? "text-primary"
              : "text-muted-foreground"
              }`}
          >
            {activeTab === value && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />}
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[9px] font-medium whitespace-nowrap">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
