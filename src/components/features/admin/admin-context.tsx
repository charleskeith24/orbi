"use client"

import { createContext, useContext } from "react"
import type { AdminApi } from "@/lib/admin/types"
import type { MfaClient } from "./api/mfa-client"

/** live = the real `/api/admin/*` routes and Supabase MFA · fixture = the dev-only sample data. */
export type AdminSource = "live" | "fixture"

export interface AdminIdentity {
  /** Empty while 2-step verification is still pending (the gate only knows the email then). */
  id: string
  email: string
}

export interface AdminContextValue {
  api: AdminApi
  mfa: MfaClient
  source: AdminSource
  self: AdminIdentity | null
}

const AdminContext = createContext<AdminContextValue | null>(null)

export const AdminProvider = AdminContext.Provider

/** The admin data client, MFA client and who's signed in. Only inside `AdminArea`. */
export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext)
  if (!value) throw new Error("useAdmin() must be used inside <AdminArea>.")
  return value
}
