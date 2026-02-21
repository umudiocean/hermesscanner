// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Blacklist (DEVRE DIŞI)
// Tüm blacklist sembolleri symbols.ts'den fiziksel olarak silindi
// Bu dosya backward compatibility için boş bırakıldı
// Son güncelleme: 2026-02-12
// ═══════════════════════════════════════════════════════════════════

// Boş blacklist - tüm sembloller zaten temizlendi
export const FULL_BLACKLIST: Set<string> = new Set()

export function isBlacklisted(_symbol: string): boolean {
  return false
}

export function getCleanSymbols(symbols: string[]): string[] {
  return symbols
}

export function blacklistStats(): Record<string, number> {
  return {
    permanent: 0,
    high_risk: 0,
    additional: 0,
    v14_high_mae: 0,
    total: 0,
  }
}
