import type { Metadata } from "next"
import { Suspense } from "react"
import { ProblemBankView } from "@/components/features/audience/problem-bank-view"

export const metadata: Metadata = { title: "Problem Bank" }

export default function Page() {
  return (
    <Suspense>
      <ProblemBankView />
    </Suspense>
  )
}
