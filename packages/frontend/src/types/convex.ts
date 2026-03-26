import type { ConvexFunctionType } from '@/types/query-console'

export type ConvexQueryResponse = {
  functionType: ConvexFunctionType
  path: string
  args: Record<string, unknown>
  value: unknown
  logLines: string[]
}
