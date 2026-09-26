/** The Settings → AI key card's data client: `/api/ai/key` over HTTP, or the dev-only fixture. */
import { AI_KEY_ROUTE, type AiKeyErrorCode, type AiKeySaveInput, type AiKeyState } from "@/lib/ai/byok/types"

export interface AiKeyClient {
  get(options?: { models?: boolean }): Promise<AiKeyState>
  save(input: AiKeySaveInput): Promise<AiKeyState>
  setModel(model: string): Promise<AiKeyState>
  remove(): Promise<AiKeyState>
}

/** A refused request, with the route's code so the card can say it in the UI language. */
export class AiKeyRequestError extends Error {
  constructor(
    message: string,
    readonly code: AiKeyErrorCode | "network"
  ) {
    super(message)
    this.name = "AiKeyRequestError"
  }
}

async function call(method: "GET" | "PUT" | "PATCH" | "DELETE", query = "", body?: unknown): Promise<AiKeyState> {
  let response: Response
  try {
    response = await fetch(`${AI_KEY_ROUTE}${query}`, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new AiKeyRequestError("Couldn't reach Orbi. Check your connection and try again.", "network")
  }
  const json = (await response.json().catch(() => ({}))) as AiKeyState & { error?: string; code?: AiKeyErrorCode }
  if (!response.ok) throw new AiKeyRequestError(json.error ?? "Something went wrong. Try again in a moment.", json.code ?? "server_error")
  return json
}

export const httpAiKeyClient: AiKeyClient = {
  get: (options) => call("GET", options?.models ? "?models=1" : ""),
  save: (input) => call("PUT", "", input),
  setModel: (model) => call("PATCH", "", { model }),
  remove: () => call("DELETE"),
}
