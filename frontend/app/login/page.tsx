"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import logoRodrigoEntrenador from "../../assets/LOGO-RODRIGO-VERDE.png";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");

    if (username === "RM.ENTRENADOR" && password === "40518231") {
      localStorage.setItem("isAuthenticated", "true");
      router.push("/dashboard");
    } else {
      setError("Usuario o contraseña incorrectos");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <Card className="w-full max-w-md">
        <div className="flex justify-center">
        <CardHeader className="flex justify-center pb-2">
          <Image
            src={logoRodrigoEntrenador}
            alt="Logo"
            width={200}
            className="mb-4"
            priority
          />
        </CardHeader>
        </div>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                name="username"
                placeholder="Nombre de usuario"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                name="password"
                placeholder="Contraseña"
                required
                disabled={loading}
              />
            </div>
            {error && (
              <div className="text-sm text-red-500 text-center">{error}</div>
            )}
            <Button
              type="submit"
              className="w-full bg-[var(--primary-color)] hover:bg-[var(--primary-color)]"
              disabled={loading}
            >
              {loading ? "Cargando..." : "Inicia sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}