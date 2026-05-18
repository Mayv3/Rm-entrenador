import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isoToDisplayDate = (iso: string): string => {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return ""
  return `${d}/${m}/${y}`
}

export const displayDateToIso = (display: string): string | null => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim())
  if (!match) return null
  const [, d, m, y] = match
  const dn = Number(d), mn = Number(m), yn = Number(y)
  if (mn < 1 || mn > 12 || dn < 1 || dn > 31 || yn < 1900) return null
  return `${y}-${m}-${d}`
}

export const calculateDueDate = (date: string, months: number): string => {
  if (!date) return ""
  const [year, month, day] = date.split("-").map(Number)
  const newDate = new Date(year, month - 1, day)
  newDate.setMonth(newDate.getMonth() + months)
  const y = newDate.getFullYear()
  const m = String(newDate.getMonth() + 1).padStart(2, "0")
  const d = String(newDate.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
