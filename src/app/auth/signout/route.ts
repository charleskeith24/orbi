import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/** Signs out this browser's session (form POST from the user menu) and returns to /login. */
export async function POST(request: NextRequest) {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient()
    // "local" ends this device's session only; other signed-in devices stay signed in.
    await supabase.auth.signOut({ scope: "local" })
  }
  // 303 turns the POST into a GET of /login (a 307 would re-POST).
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 })
}
