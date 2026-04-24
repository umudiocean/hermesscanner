'use client'

import Link from 'next/link'
import { ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui'
import { HermesLogo } from '@/components/shell/HermesLogo'

// ═══════════════════════════════════════════════════════════════════
// 404 — premium not-found page
// ═══════════════════════════════════════════════════════════════════

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-surface-0 overflow-hidden">
      {/* Ambient backgrounds */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(closest-side, rgba(212,184,106,0.55), transparent 70%)', filter: 'blur(70px)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(212,184,106,0.6) 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />
      </div>

      <div className="relative z-10 max-w-md w-full mx-auto px-6 text-center">
        <div className="inline-flex items-center justify-center mb-6">
          <HermesLogo size={56} />
        </div>

        <div className="text-7xl sm:text-8xl font-bold tracking-tightest leading-none">
          <span className="bg-gradient-to-b from-gold-300 to-gold-600 bg-clip-text text-transparent">
            404
          </span>
        </div>

        <h1 className="mt-4 text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">
          Bu sayfa neural ağda yok
        </h1>
        <p className="mt-2 text-sm text-text-tertiary leading-relaxed">
          Aradığın sayfa silinmiş, taşınmış veya hiç var olmamış olabilir.
          Pazar seçimine dön veya ⌘K ile arama yap.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link href="/" className="inline-block">
            <Button variant="primary" size="md" leftIcon={<Home size={14} />}>
              Ana sayfaya dön
            </Button>
          </Link>
          <button
            onClick={() => history.back()}
            className="text-xs text-text-tertiary hover:text-text-primary underline underline-offset-2 transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={12} />
            Önceki sayfaya geri
          </button>
        </div>
      </div>
    </div>
  )
}
