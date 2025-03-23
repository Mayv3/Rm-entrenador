import type { Metadata } from "next";
import "@/styles/globals.css";
import { Comfortaa } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

const comfortaa = Comfortaa({ subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "RM ENTRENADOR",
  description: "Plataforma de entrenamiento y seguimiento de alumnos.",
  viewport: "width=device-width, initial-scale=1",
  icons: {
    icon: "/favicon.png", // Ruta del favicon en la carpeta public
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={comfortaa.className}>
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
          forcedTheme="light" // ✅ Siempre en modo claro
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
