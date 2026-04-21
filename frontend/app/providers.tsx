"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { ThemeProvider } from "next-themes"
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles"
import { useTheme } from "next-themes"
import { SessionProvider } from "next-auth/react"

function MuiSyncProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()

  const muiTheme = createTheme({
    palette: {
      mode: resolvedTheme === "dark" ? "dark" : "light",
    },
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
