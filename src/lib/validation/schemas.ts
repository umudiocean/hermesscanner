// ═══════════════════════════════════════════════════════════════════
// Zod v4 runtime validation schemas for API route params
// ═══════════════════════════════════════════════════════════════════

import { z } from 'zod'

// Symbol: 1-10 uppercase alphanumeric + dots/dashes (e.g. BRK.B, CARR-W)
const symbolPattern = /^[A-Z0-9.\-]{1,10}$/

export const symbolSchema = z.string().regex(symbolPattern, 'Invalid symbol format')

export const symbolsParamSchema = z
  .string()
  .min(1, 'symbols param required')
  .max(20_000, 'symbols param too long')
  .transform((val) =>
    val
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => symbolPattern.test(s))
  )
  .pipe(z.array(z.string()).min(1, 'No valid symbols provided'))

export const segmentSchema = z.enum(['ALL', 'MEGA', 'LARGE', 'MID', 'SMALL', 'MICRO'])

export const pageSchema = z.coerce.number().int().min(0).max(10_000).default(0)

export const limitSchema = z.coerce.number().int().min(1).max(500).default(20)

export const coinIdSchema = z
  .string()
  .min(1, 'coin id required')
  .max(100, 'coin id too long')
  .regex(/^[a-z0-9\-_.]+$/, 'Invalid coin id format')

// POST /api/scan/latest body
export const scanLatestBodySchema = z.object({
  results: z.array(z.any()).min(1).max(5000),
  scanId: z.string().max(200).optional(),
})

// Search query
export const searchQuerySchema = z
  .string()
  .max(200, 'Query too long')
  .transform((v) => v.trim())

// Generic helper: parse and return typed result or error response
export function validateParams<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const firstIssue = result.error.issues[0]
  return { success: false, error: firstIssue?.message || 'Validation error' }
}
