"use client"

import { useSyncExternalStore } from "react"

export type SaveStatus = "idle" | "saving" | "saved" | "error"

let status: SaveStatus = "idle"
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function setSaveStatus(s: SaveStatus) {
  if (status === s) return
  status = s
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function getSnapshot() {
  return status
}

function getServerSnapshot(): SaveStatus {
  return "idle"
}

export function useSaveStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
