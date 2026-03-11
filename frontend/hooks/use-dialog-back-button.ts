import { useEffect } from "react"

export function useDialogBackButton(open: boolean, onOpenChange: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return

    history.pushState(null, "", location.href)

    const handlePopState = () => {
      onOpenChange(false)
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [open, onOpenChange])
}
