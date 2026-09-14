"use client"

import { Clock } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ONBOARDING_LANGS, useCopy, type OnboardingLang } from "./copy"

/** First screen: pick English or Taglish, and see how Niche Discovery leads into setup. */
export function WelcomeStep({ lang, onLang }: { lang: OnboardingLang; onLang: (lang: OnboardingLang) => void }) {
  const copy = useCopy()
  const t = copy.welcome
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="ob-lang-title" className="flex flex-col gap-3">
        <h2 id="ob-lang-title" className="text-sm font-medium">
          {t.chooseLanguage}
        </h2>
        <RadioGroup
          value={lang}
          onValueChange={(value) => {
            if (value === "english" || value === "taglish") onLang(value)
          }}
          className="grid gap-2 sm:grid-cols-2"
          aria-labelledby="ob-lang-title"
        >
          {ONBOARDING_LANGS.map((l) => (
            <label
              key={l}
              htmlFor={`ob-lang-${l}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 has-data-checked:border-brand/45 has-data-checked:bg-brand-soft dark:bg-input/20"
            >
              <RadioGroupItem id={`ob-lang-${l}`} value={l} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{copy.lang[l]}</span>
                <span className="block text-xs text-muted-foreground">{l === "english" ? t.englishHint : t.taglishHint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <p className="text-xs text-pretty text-muted-foreground">{t.languageHint}</p>
      </section>

      <section aria-labelledby="ob-how-title" className="rounded-lg border bg-card p-4 dark:bg-input/20">
        <h2 id="ob-how-title" className="text-sm font-medium">
          {t.how}
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {t.flow.map((item, index) => (
            <li key={item.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-medium num">{index + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-pretty text-muted-foreground">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          {t.time}
        </p>
      </section>
    </div>
  )
}
