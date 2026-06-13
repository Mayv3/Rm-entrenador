"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { ThemeProvider } from "next-themes"
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles"
import { useTheme } from "next-themes"
import { SessionProvider } from "next-auth/react"

function MuiSyncProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === "dark"

  const muiTheme = createTheme({
    palette: {
      mode: isDark ? "dark" : "light",
      primary: { main: "#22b567", dark: "#059669", light: "#6ee7b7", contrastText: "#ffffff" },
      success: { main: "#22b567", contrastText: "#ffffff" },
      ...(isDark
        ? { background: { default: "#0c1210", paper: "#141d18" }, divider: "#26322c" }
        : { background: { default: "#f7f8f7", paper: "#ffffff" }, divider: "#e3e9e5" }),
    },
    shape: { borderRadius: 12 },
    typography: { fontFamily: "Comfortaa, ui-sans-serif, system-ui, sans-serif" },
  })

  return <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <MuiSyncProvider>
            {children}
          </MuiSyncProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
