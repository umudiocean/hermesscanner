// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Structured Logger
// Production-grade logging with severity, context, and JSON output
// ═══════════════════════════════════════════════════════════════════

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

export interface LogContext {
  module?: string
  symbol?: string
  endpoint?: string
  duration?: number
  error?: unknown
  [key: string]: unknown
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
}

const LOG_COLORS: Record<LogLevel, string> = {
  DEBUG: '\x1b[90m',  // gray
  INFO: '\x1b[36m',   // cyan
  WARN: '\x1b[33m',   // yellow
  ERROR: '\x1b[31m',  // red
  FATAL: '\x1b[35m',  // magenta
}

const RESET = '\x1b[0m'

const IS_PROD = process.env.NODE_ENV === 'production'
const MIN_LEVEL: LogLevel = IS_PROD ? 'INFO' : 'DEBUG'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LEVEL]
}

function formatError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  if (typeof err === 'string') return err
  try { return JSON.stringify(err) } catch { return String(err) }
}

function formatContext(ctx: LogContext): string {
  const parts: string[] = []
  if (ctx.module) parts.push(`[${ctx.module}]`)
  if (ctx.symbol) parts.push(`sym=${ctx.symbol}`)
  if (ctx.endpoint) parts.push(`ep=${ctx.endpoint}`)
  if (ctx.duration !== undefined) parts.push(`${ctx.duration}ms`)
  if (ctx.error) parts.push(`err=${formatError(ctx.error)}`)
  // Add any extra fields
  for (const [k, v] of Object.entries(ctx)) {
    if (['module', 'symbol', 'endpoint', 'duration', 'error'].includes(k)) continue
    if (v !== undefined && v !== null) parts.push(`${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
  }
  return parts.join(' ')
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  }

  if (IS_PROD) {
    // JSON output for log aggregation
    const jsonEntry: Record<string, unknown> = {
      level: entry.level,
      msg: entry.message,
      ts: entry.timestamp,
    }
    if (context) {
      if (context.module) jsonEntry.module = context.module
      if (context.symbol) jsonEntry.symbol = context.symbol
      if (context.endpoint) jsonEntry.endpoint = context.endpoint
      if (context.duration !== undefined) jsonEntry.duration = context.duration
      if (context.error) jsonEntry.error = formatError(context.error)
    }
    const line = JSON.stringify(jsonEntry)
    if (level === 'ERROR' || level === 'FATAL') {
      console.error(line)
    } else if (level === 'WARN') {
      console.warn(line)
    } else {
      console.log(line)
    }
  } else {
    // Colorized dev output
    const color = LOG_COLORS[level]
    const prefix = `${color}[${level}]${RESET}`
    const ctxStr = context ? ` ${formatContext(context)}` : ''
    const line = `${prefix} ${message}${ctxStr}`
    if (level === 'ERROR' || level === 'FATAL') {
      console.error(line)
    } else if (level === 'WARN') {
      console.warn(line)
    } else {
      console.log(line)
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export const logger = {
  debug: (message: string, context?: LogContext) => emit('DEBUG', message, context),
  info: (message: string, context?: LogContext) => emit('INFO', message, context),
  warn: (message: string, context?: LogContext) => emit('WARN', message, context),
  error: (message: string, context?: LogContext) => emit('ERROR', message, context),
  fatal: (message: string, context?: LogContext) => emit('FATAL', message, context),
}

// ─── Error Classification ───────────────────────────────────────────

export type ErrorSeverity = 'hard' | 'soft'

export interface ClassifiedError {
  severity: ErrorSeverity
  code: string
  message: string
  original?: unknown
}

export function classifyError(err: unknown, endpoint?: string): ClassifiedError {
  const message = formatError(err)

  // Timeout
  if (err instanceof DOMException && err.name === 'AbortError') {
    return { severity: 'soft', code: 'TIMEOUT', message: `Request timed out: ${endpoint || 'unknown'}`, original: err }
  }

  // Network / fetch failure
  if (err instanceof TypeError && message.includes('fetch')) {
    return { severity: 'hard', code: 'NETWORK', message: `Network error: ${message}`, original: err }
  }

  // HTTP status based
  if (message.includes('401') || message.includes('403')) {
    return { severity: 'hard', code: 'AUTH', message: `Authentication failed: ${endpoint || ''}`, original: err }
  }

  if (message.includes('404')) {
    return { severity: 'soft', code: 'NOT_FOUND', message: `Not found: ${endpoint || ''}`, original: err }
  }

  if (message.includes('429')) {
    return { severity: 'soft', code: 'RATE_LIMIT', message: `Rate limited: ${endpoint || ''}`, original: err }
  }

  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return { severity: 'soft', code: 'SERVER_ERROR', message: `Server error: ${message}`, original: err }
  }

  // Generic
  return { severity: 'soft', code: 'UNKNOWN', message, original: err }
}

export default logger
