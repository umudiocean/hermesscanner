// ═══════════════════════════════════════════════════════════════════
// cn — class name merge utility (zero-dep clsx replacement)
// Accepts: string | number | undefined | null | false | object | array
// ═══════════════════════════════════════════════════════════════════

type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | { [key: string]: unknown }
  | ClassValue[]

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = []
  for (const v of inputs) {
    if (!v) continue
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v))
    } else if (Array.isArray(v)) {
      const nested = cn(...v)
      if (nested) out.push(nested)
    } else if (typeof v === 'object') {
      for (const k in v) if (v[k]) out.push(k)
    }
  }
  return out.join(' ')
}
