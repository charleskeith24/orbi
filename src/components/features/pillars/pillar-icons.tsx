import {
  Award,
  BadgeDollarSign,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Camera,
  ChartLine,
  Code,
  Coffee,
  Compass,
  Crown,
  Flame,
  Globe,
  GraduationCap,
  Handshake,
  Heart,
  Layers,
  Leaf,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Mic,
  Palette,
  PenTool,
  Rocket,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { catWash } from "@/components/common"
import type { CategoricalColor } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface PillarIconOption {
  /** lucide-react export name, stored in `content_pillars.icon`. */
  name: string
  label: string
  icon: LucideIcon
}

/** Curated pillar icons — a small fixed set so every pillar reads at a glance. */
export const PILLAR_ICON_OPTIONS: PillarIconOption[] = [
  { name: "GraduationCap", label: "Education", icon: GraduationCap },
  { name: "Award", label: "Authority", icon: Award },
  { name: "Route", label: "Journey", icon: Route },
  { name: "Users", label: "Team", icon: Users },
  { name: "Heart", label: "Personal", icon: Heart },
  { name: "Briefcase", label: "Business", icon: Briefcase },
  { name: "Lightbulb", label: "Ideas", icon: Lightbulb },
  { name: "Megaphone", label: "Announcements", icon: Megaphone },
  { name: "Rocket", label: "Growth", icon: Rocket },
  { name: "Target", label: "Goals", icon: Target },
  { name: "TrendingUp", label: "Results", icon: TrendingUp },
  { name: "ChartLine", label: "Data", icon: ChartLine },
  { name: "BookOpen", label: "Stories", icon: BookOpen },
  { name: "Mic", label: "Speaking", icon: Mic },
  { name: "Camera", label: "Behind the scenes", icon: Camera },
  { name: "Compass", label: "Strategy", icon: Compass },
  { name: "Brain", label: "Mindset", icon: Brain },
  { name: "MessageCircle", label: "Community", icon: MessageCircle },
  { name: "Handshake", label: "Partnerships", icon: Handshake },
  { name: "Wrench", label: "Tools", icon: Wrench },
  { name: "Code", label: "Tech", icon: Code },
  { name: "Palette", label: "Creative", icon: Palette },
  { name: "PenTool", label: "Design", icon: PenTool },
  { name: "Sparkles", label: "Inspiration", icon: Sparkles },
  { name: "Flame", label: "Opinions", icon: Flame },
  { name: "Trophy", label: "Wins", icon: Trophy },
  { name: "Star", label: "Highlights", icon: Star },
  { name: "Crown", label: "Leadership", icon: Crown },
  { name: "ShieldCheck", label: "Trust", icon: ShieldCheck },
  { name: "BadgeDollarSign", label: "Money", icon: BadgeDollarSign },
  { name: "Building2", label: "Company", icon: Building2 },
  { name: "Globe", label: "Industry", icon: Globe },
  { name: "Zap", label: "Quick tips", icon: Zap },
  { name: "Coffee", label: "Routines", icon: Coffee },
  { name: "Leaf", label: "Values", icon: Leaf },
  { name: "Layers", label: "General", icon: Layers },
]

export const DEFAULT_PILLAR_ICON = "Layers"

const ICONS: Record<string, LucideIcon> = Object.fromEntries(PILLAR_ICON_OPTIONS.map((o) => [o.name, o.icon]))

/** Pillar glyph from its stored icon name; unknown names fall back to Layers. Decorative. */
export function PillarIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = ICONS[name ?? ""] ?? Layers
  return <Icon className={className} aria-hidden />
}

/** Icon on a soft wash of the pillar colour — the pillar's identity on cards and sheets. */
export function PillarIconTile({
  name,
  color,
  size = "md",
  className,
}: {
  name: string | null | undefined
  color: CategoricalColor
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border text-foreground/80",
        size === "sm" ? "size-6 [&_svg]:size-3.5" : size === "lg" ? "size-10 [&_svg]:size-5" : "size-8 [&_svg]:size-4",
        className
      )}
      style={{ backgroundColor: catWash(color, 16), borderColor: catWash(color, 34) }}
    >
      <PillarIcon name={name} />
    </span>
  )
}
