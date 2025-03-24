"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import logoRodrigoEntrenador from "../assets/LOGO-RODRIGO-VERDE.png";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function DashboardHeader() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-16 items-center justify-between py-10 px-4 container">
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <Image src={logoRodrigoEntrenador} alt="Logo" width={150} className="z-10" />
        </div>
        <div className="flex h-16 items-center justify-between py-10 px-4 container flex-row-reverse">
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Image src={logoRodrigoEntrenador} alt="Logo" width={150} className="z-10" />
          </div>
          <div className="absolute right-3 lg:p-4">
            <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-600 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </Button></div>
        </div>
      </div>
    </header>
  );
}