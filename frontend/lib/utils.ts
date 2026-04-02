import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
