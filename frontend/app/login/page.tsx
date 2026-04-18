"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import logoRodrigoEntrenador from "../../assets/LOGO-RODRIGO-VERDE.png";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("isAuthenticated") === "true") {
      router.push("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      localStorage.setItem("isAuthenticated", "true");
      router.replace("/dashboard");
    } else {
      setError("Usuario o contraseña incorrectos");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {/* background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-green-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col gap-8">

        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src={logoRodrigoEntrenador}
            alt="Logo"
            width={140}
            priority
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 flex flex-col gap-6 shadow-2xl">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-zinc-100">Bienvenido</h1>
            <p className="text-sm text-zinc-500">Ingresá tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
                Usuario
              </label>
              <input
                type="text"
                name="username"
                placeholder="Nombre de usuario"
                required
                disabled={loading}
                className="w-full rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 text-center bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-semibold text-sm py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
