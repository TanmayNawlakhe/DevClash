import type { AnalysisStatus, Layer, ViewMode } from '../types'

export const LAYER_COLORS: Record<Layer, { bg: string; text: string; hex: string; label: string }> = {
  entry_point:     { bg: 'bg-chart-1/15', text: 'text-chart-1',           hex: 'var(--chart-1)',           label: 'Entry Point' },
  api:             { bg: 'bg-chart-2/15', text: 'text-chart-2',           hex: 'var(--chart-2)',           label: 'API' },
  business_logic:  { bg: 'bg-chart-3/15', text: 'text-chart-3',           hex: 'var(--chart-3)',           label: 'Business Logic' },
  data:            { bg: 'bg-chart-4/15', text: 'text-chart-4',           hex: 'var(--chart-4)',           label: 'Data' },
  data_access:     { bg: 'bg-chart-4/15', text: 'text-chart-4',           hex: 'var(--chart-4)',           label: 'Data Access' },
  util:            { bg: 'bg-chart-5/15', text: 'text-chart-5',           hex: 'var(--chart-5)',           label: 'Util' },
  utility:         { bg: 'bg-chart-5/15', text: 'text-chart-5',           hex: 'var(--chart-5)',           label: 'Utility' },
  config:          { bg: 'bg-muted',      text: 'text-muted-foreground',  hex: 'var(--muted-foreground)', label: 'Config' },
  test:            { bg: 'bg-secondary',  text: 'text-secondary-foreground', hex: 'var(--secondary)',     label: 'Test' },
  middleware:      { bg: 'bg-chart-2/10', text: 'text-chart-2',           hex: 'var(--chart-2)',           label: 'Middleware' },
  ui:              { bg: 'bg-chart-1/10', text: 'text-chart-1',           hex: 'var(--chart-1)',           label: 'UI' },
  integration:     { bg: 'bg-chart-3/10', text: 'text-chart-3',           hex: 'var(--chart-3)',           label: 'Integration' },
  background_jobs: { bg: 'bg-chart-5/10', text: 'text-chart-5',           hex: 'var(--chart-5)',           label: 'Background Jobs' },
}

export const VIEW_MODES: ViewMode[] = ['dependency', 'ownership', 'priority']

export const ANALYSIS_STAGES: Array<{ key: AnalysisStatus; label: string }> = [
  { key: 'pending', label: 'Queued' },
  { key: 'cloning', label: 'Cloning Repository' },
  { key: 'parsing', label: 'Parsing Files' },
  { key: 'analyzing', label: 'Building Graph' },
  { key: 'ai_processing', label: 'AI Analysis' },
  { key: 'complete', label: 'Complete' },
]

export const LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'Go'] as const

export const STATUS_LABELS: Record<AnalysisStatus, string> = {
  idle: 'Idle',
  pending: 'Queued',
  cloning: 'Cloning',
  parsing: 'Parsing',
  analyzing: 'Analyzing',
  ai_processing: 'AI Processing',
  cancelling: 'Cancelling',
  cancelled: 'Cancelled',
  complete: 'Complete',
  failed: 'Failed',
}
