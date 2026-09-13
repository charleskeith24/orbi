import {
  Crosshair,
  Fingerprint,
  GraduationCap,
  IdCard,
  Languages,
  MessageSquareQuote,
  Quote,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import type { BrandSectionKey } from "./brand-model"

export const SECTION_ICONS: Record<BrandSectionKey, LucideIcon> = {
  identity: IdCard,
  positioning: Crosshair,
  statement: Quote,
  expertise: GraduationCap,
  personality: Fingerprint,
  communication: Languages,
  rules: ShieldCheck,
}

export const VOICE_ICON: LucideIcon = MessageSquareQuote
