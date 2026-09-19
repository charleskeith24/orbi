/**
 * Shared building blocks for every feature page. Import from "@/components/common".
 * Named re-exports only (no `export *`) so client/server boundaries stay explicit.
 */
export type { ControlSize, IconComponent, StatusTone } from "@/components/common/types"
export { TONE_FILL, TONE_ICON, TONE_SOFT, TONE_STROKE, TONE_TEXT, toneForScore } from "@/components/common/tone"
export { chipVariants, Token, type ChipVariantProps } from "@/components/common/chip"

// Layout (Calm UI: PageHeader/SectionHeader take `info`; details go in Disclosure; sub-pages are HubTabs)
export { PageContainer, PageHeader, PageSection, SectionHeader, type PageWidth } from "@/components/common/page"
export { SectionCard } from "@/components/common/section-card"
export { InfoHint } from "@/components/common/info-hint"
export { Disclosure } from "@/components/common/disclosure"
export { activeHubTab, HubTabs, type HubTab } from "@/components/common/hub-tabs"
export { DetailSheet } from "@/components/common/detail-sheet"
export { DefinitionList, KeyValue, type DefinitionItem } from "@/components/common/kv"
export { EmptyState } from "@/components/common/empty-state"

// Numbers
export { Delta, Sparkline, StatTile, type StatTileProps } from "@/components/common/stat-tile"
export { Meter, ScoreRing, type MeterProps, type MeterTone, type ScoreRingProps } from "@/components/common/meter"

// Identity & status
export { catVar, catWash, ColorDot, ColorSwatchPicker } from "@/components/common/color"
export { PlatformIcon, PlatformLabel, PlatformToggleGroup } from "@/components/common/platform-icon"
export {
  CampaignBadge,
  FORMAT_CATEGORY_ICONS,
  FormatCategoryIcon,
  FormatLabel,
  formatCategoryIcon,
  PersonaBadge,
  PillarBadge,
  TagChip,
  TagList,
} from "@/components/common/entity-badges"
export {
  FunnelBadge,
  HealthBadge,
  IDEA_STATUS_ICONS,
  IdeaStatusBadge,
  PriorityBadge,
  PriorityIcon,
  StageBadge,
  StageIcon,
  StatusPill,
  TIER_ICONS,
  TierBadge,
} from "@/components/common/status-badges"

// Content
export { ContentThumbnail, type ThumbnailItem } from "@/components/common/content-thumbnail"
export { ContentCard, contentDateInfo, type ContentCardProps } from "@/components/common/content-card"

// Inputs
export {
  AngleSelect,
  CampaignSelect,
  FormatSelect,
  FunnelSelect,
  GoalSelect,
  HookCategorySelect,
  HookSelect,
  IdeaStatusSelect,
  OptionSelect,
  PersonaSelect,
  PillarSelect,
  PlatformSelect,
  PrioritySelect,
  ProblemSelect,
  SeriesSelect,
  StageSelect,
  type BaseSelectProps,
  type SelectOption,
} from "@/components/common/entity-select"
export {
  CheckboxIndicator,
  ChipToggleGroup,
  keywordFilter,
  MultiSelect,
  type ChipOption,
  type ChipToggleGroupProps,
  type MultiSelectOption,
} from "@/components/common/multi-select"
export { ListEditor, type ListEditorProps } from "@/components/common/list-editor"
export { EntityTagEditor, TagPicker } from "@/components/common/tag-picker"
export { DatePicker, DateTimePicker, TimeInput } from "@/components/common/date-picker"
export { NumberField, parseNumberInput } from "@/components/common/number-field"
export { InlineText } from "@/components/common/inline-edit"
export { FormActions, FormField, FormRow } from "@/components/common/form"

// Collections
export {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
} from "@/components/common/data-table"
export { FacetFilter, FilterBar, ResetFiltersButton, SearchInput, type FacetOption } from "@/components/common/filter-bar"
export { ViewToggle, type ViewOption } from "@/components/common/view-toggle"

// Actions & feedback
export { ConfirmDialog, useConfirm, type ConfirmDialogProps, type ConfirmOptions } from "@/components/common/confirm-dialog"
export { CopyButton } from "@/components/common/copy-button"
export { AiButton, AiNotice, prettyModelName, ProviderBadge } from "@/components/common/ai"
export { Markdown, parseMarkdown } from "@/components/common/markdown"
