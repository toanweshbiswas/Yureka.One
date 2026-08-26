export type ScanResult = {
  profile?: Record<string, unknown>
  transactions?: Array<Record<string, unknown>>
  score?: { score?: number; decision?: string; metrics?: unknown }
  error?: string
  details?: string
}
