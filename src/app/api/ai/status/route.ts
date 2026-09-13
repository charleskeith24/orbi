/** GET /api/ai/status → { provider, model, configured, reason } — which engine the gateway will use. */
import { providerStatus } from "@/lib/ai/providers"

export async function GET(): Promise<Response> {
  const status = providerStatus()
  return Response.json(status, { headers: { "Cache-Control": "no-store" } })
}
