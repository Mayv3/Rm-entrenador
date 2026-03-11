import type { Metadata } from "next";
import "@/styles/globals.css";
import { Comfortaa } from "next/font/google";
import { Providers } from "./providers";

const comfortaa = Comfortaa({ subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "RM ENTRENADOR",
  description: "Plataforma de entrenamiento y seguimiento de alumnos.",
  viewport: "width=device-width, initial-scale=1",
  icons: {
    icon: "/favicon.png",
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
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}