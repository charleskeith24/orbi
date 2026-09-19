import type { Metadata } from "next"

/** The admin area (/admin): its own minimal frame — no creator workspace is loaded here. */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-background">{children}</div>
}
