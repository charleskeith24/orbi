import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { AuthBrand } from "@/components/features/auth/auth-brand"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex justify-end p-3">
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm space-y-6">
          <AuthBrand />
          {children}
        </div>
      </main>
    </div>
  )
}
