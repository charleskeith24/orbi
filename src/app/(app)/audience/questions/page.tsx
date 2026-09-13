import type { Metadata } from "next"
import { Suspense } from "react"
import { QuestionBankView } from "@/components/features/audience/question-bank-view"

export const metadata: Metadata = { title: "Question Bank" }

export default function Page() {
  return (
    <Suspense>
      <QuestionBankView />
    </Suspense>
  )
}
