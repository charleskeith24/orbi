/**
 * Chart kit — data-viz rules baked in (fixed categorical order, one y-axis, thin marks, hairline grid,
 * tooltips that never gate, table twins via ChartFrame). Colors are CSS variables, so charts follow the
 * theme without re-rendering.
 */
export { BarList, type BarListItem, type BarListProps } from "@/components/charts/bar-list"
export { ChartFrame, type ChartFrameProps, type ChartTable } from "@/components/charts/chart-frame"
export {
  CHART_SURFACE,
  MAX_SERIES,
  SERIES_ORDER,
  onColorTextClass,
  ordinalColor,
  platformColor,
  resolveColor,
  sequentialColor,
  seriesColor,
  seriesColorAt,
  statusColor,
  statusTextColor,
  type ChartColor,
  type ColorInput,
  type StatusTone,
} from "@/components/charts/colors"
export { ColumnChart, type ColumnChartProps, type ColumnDatum } from "@/components/charts/column-chart"
export { DonutChart, type DonutChartProps, type DonutSegment } from "@/components/charts/donut-chart"
export { EmptyChart, type EmptyChartProps } from "@/components/charts/empty-chart"
export { FunnelBars, type FunnelBarsProps, type FunnelStageDatum } from "@/components/charts/funnel-bars"
export { Heatmap, type HeatmapAxisItem, type HeatmapCell, type HeatmapProps } from "@/components/charts/heatmap"
export { MixBar, type MixBarProps, type MixSegment, type MixTarget } from "@/components/charts/mix-bar"
export {
  ChartTooltipCard,
  SeriesKey,
  SeriesLegend,
  type LegendEntry,
  type SeriesMark,
  type TooltipRow,
} from "@/components/charts/primitives"
export { Sparkline, type SparklineProps } from "@/components/charts/sparkline"
export { TrendChart, type TrendChartProps, type TrendDatum, type TrendSeries } from "@/components/charts/trend-chart"
export {
  OTHER_ID,
  defaultValueFormatter,
  foldToOther,
  formatAxisValue,
  formatShare,
  type ChartPart,
} from "@/components/charts/utils"
