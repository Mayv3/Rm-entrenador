"use client"

import { useSyncExternalStore } from "react"

export type SaveStatus = "idle" | "saving" | "saved" | "error"

interface State {
  status: SaveStatus
  ejIds: number[]
}

let state: State = { status: "idle", ejIds: [] }
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function setSaveStatus(status: SaveStatus, ejIds: number[] = []) {
  if (state.status === status && state.ejIds.length === ejIds.length && state.ejIds.every((id, i) => id === ejIds[i])) return
  state = { status, ejIds }
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function getSnapshot() {
  return state
}

function getServerSnapshot(): State {
  return { status: "idle", ejIds: [] }
}

export function useSaveStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useSaveStatusForEj(ejId: number): SaveStatus {
  const s = useSaveStatus()
  if (s.status === "idle") return "idle"
  return s.ejIds.includes(ejId) ? s.status : "idle"
}
