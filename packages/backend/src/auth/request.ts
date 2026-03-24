import type { Request } from 'express'
import type { AuthPrincipal } from './types.ts'

export type AuthenticatedRequest = Request & {
  auth: AuthPrincipal
}

