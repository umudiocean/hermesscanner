'use client'

import { LEGAL_DISCLAIMER_TEXT } from '@/lib/legal-disclaimer'

export default function LegalDisclaimerStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-amber-500/20 bg-gold-500/8 ${compact ? 'px-2 py-1' : 'px-3 py-2'}`}>
      <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-amber-200/90 leading-tight`}>
        {LEGAL_DISCLAIMER_TEXT}
      </p>
    </div>
  )
}
