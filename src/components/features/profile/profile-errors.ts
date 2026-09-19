"use client"

import { useCallback } from "react"
import { useT } from "@/lib/i18n"
import { toProfileError, type ProfileErrorCode } from "@/lib/profiles/types"
import { profileMessages } from "./messages"

const KEYS: Record<ProfileErrorCode, keyof (typeof profileMessages)["en"]> = {
  not_signed_in: "error_not_signed_in",
  invalid: "error_invalid",
  not_image: "error_not_image",
  too_large: "error_too_large",
  heic_unsupported: "error_heic",
  decode_failed: "error_decode",
  storage_full: "error_storage_full",
  network: "error_network",
  unknown: "error_unknown",
}

/** Any profile failure → one sentence the creator can act on. */
export function useDescribeProfileError(): (error: unknown) => string {
  const t = useT(profileMessages)
  return useCallback((error: unknown) => t(KEYS[toProfileError(error).code]), [t])
}
