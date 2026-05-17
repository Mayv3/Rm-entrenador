import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Comfortaa } from "next/font/google";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";

const comfortaa = Comfortaa({ subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "RM ENTRENADOR",
  description: "Plataforma de entrenamiento y seguimiento de alumnos.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RM Entrenador",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
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
        <Toaster richColors position="top-right" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}