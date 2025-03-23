import logoRodrigoEntrenador from "../assets/LOGO-RODRIGO-VERDE.png";
import Image from "next/image";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container flex h-16 items-center justify-center py-10">
          <Image src={logoRodrigoEntrenador} alt="Logo" width={150} className="z-10" />
      </div>
    </header>
  )
}

