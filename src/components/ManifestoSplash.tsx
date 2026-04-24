'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface ManifestoSplashProps {
  onClose: () => void
}

export default function ManifestoSplash({ onClose }: ManifestoSplashProps) {
  const [phase, setPhase] = useState(0)
  const [closing, setClosing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 1800),
      setTimeout(() => setPhase(5), 2400),
      setTimeout(() => setPhase(6), 3000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = 0, h = 0

    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const nodes: { x: number; y: number; vx: number; vy: number; r: number }[] = []
    const count = 50
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > w) n.vx *= -1
        if (n.y < 0 || n.y > h) n.vy *= -1
      }
      ctx.strokeStyle = 'rgba(179,148,91,0.04)'
      ctx.lineWidth = 0.5
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 180) {
            ctx.globalAlpha = (1 - dist / 180) * 0.08
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }
      for (const n of nodes) {
        ctx.globalAlpha = 0.12
        ctx.fillStyle = 'rgba(179,148,91,0.6)'
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 600)
  }

  const p = (n: number) => phase >= n
  const d = (ms: number) => ({ transitionDelay: `${ms}ms` })

  return (
    <div className={`fixed inset-0 z-[100] bg-surface-0 transition-all duration-600 overflow-y-auto overflow-x-hidden ${closing ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>

      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* Warm ambient glows */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-900/[0.03] blur-[150px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-[20%] left-[15%] w-[200px] h-[200px] rounded-full bg-gold-400/[0.02] blur-[80px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-[15%] right-[10%] w-[250px] h-[250px] rounded-full bg-amber-800/[0.02] blur-[90px] animate-pulse" style={{ animationDuration: '8s' }} />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-8 lg:px-12 py-12 sm:py-16">

        {/* Close button */}
        <button
          onClick={handleClose}
          className="fixed top-4 right-4 z-[110] w-10 h-10 flex items-center justify-center rounded-full bg-surface-3 border border-stroke text-text-tertiary hover:text-white hover:bg-white/[0.12] transition-all duration-300"
          aria-label="Kapat"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Logo */}
        <div className={`flex items-center gap-3 mb-5 lg:mb-7 transition-all duration-700 ${p(1) ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-surface-3 border border-stroke flex items-center justify-center">
            <svg className="w-6 h-6 lg:w-7 lg:h-7" viewBox="0 0 32 32" fill="none">
              <path d="M4 22 L8.5 17 L13 19.5 L18 13 L22.5 16 L28 10" stroke="rgba(179,148,91,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="16" cy="7" r="2" fill="rgba(179,148,91,0.5)" />
              <circle cx="6" cy="10" r="1.5" fill="rgba(179,148,91,0.3)" />
              <circle cx="26" cy="12" r="1.5" fill="rgba(179,148,91,0.3)" />
              <line x1="6" y1="10" x2="16" y2="7" stroke="rgba(179,148,91,0.15)" strokeWidth="0.8" />
              <line x1="16" y1="7" x2="26" y2="12" stroke="rgba(179,148,91,0.15)" strokeWidth="0.8" />
            </svg>
          </div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight leading-none">
            <span className="text-text-primary">HERMES</span>{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-amber-400 to-gold-300">AI</span>
          </h1>
        </div>

        {/* Hero Statement */}
        <div className={`text-center mb-4 lg:mb-6 max-w-4xl transition-all duration-800 ${p(2) ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight uppercase">
            {'Türk kullanıcılar için tasarlanan bu platform tamamen '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-400">{'ücretsizdir.'}</span>
          </h2>
          <p className="mt-2 text-sm sm:text-base lg:text-lg text-text-secondary font-medium tracking-wide uppercase">
            {'ChatGPT, Claude, Kimi ve Gemini gücüyle, '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-400 font-bold">{'%100 yapay zeka'}</span>
            {' desteklidir.'}
          </p>
        </div>

        {/* Badges */}
        <div className={`flex flex-wrap items-center justify-center gap-2 mb-5 lg:mb-7 transition-all duration-800 ${p(2) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={d(300)}>
          <span className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wider bg-success-400/10 text-success-400/80 border border-success-400/30">
            %100 ÜCRETSİZ
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wider bg-info-400/10 text-info-400/80 border border-info-400/30">
            %100 YAPAY ZEKA
          </span>
          <span className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wider bg-gold-400/10 text-gold-400/80 border border-stroke-gold">
            TÜRKÇE
          </span>
        </div>

        {/* Divider */}
        <div className={`mb-5 lg:mb-7 transition-all duration-1000 ${p(2) ? 'opacity-100' : 'opacity-0'}`}>
          <div className="relative flex items-center gap-3">
            <div className={`h-[1px] bg-gradient-to-r from-transparent to-gold-400/30 transition-all duration-1000 ${p(2) ? 'w-16 lg:w-24' : 'w-0'}`} />
            <div className={`w-1.5 h-1.5 rounded-full bg-gold-400/50 transition-all duration-500 ${p(2) ? 'scale-100' : 'scale-0'}`} style={d(400)} />
            <div className={`h-[1px] bg-gradient-to-l from-transparent to-gold-400/30 transition-all duration-1000 ${p(2) ? 'w-16 lg:w-24' : 'w-0'}`} />
          </div>
        </div>

        {/* ═══ MAIN CONTENT: 3 COLUMNS ═══ */}
        <div className={`w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 transition-all duration-800 ${p(3) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* ═══ LEFT COLUMN: Vizyon + Amac ═══ */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-stroke-subtle bg-surface-2 backdrop-blur-sm px-4 py-3 lg:px-5 lg:py-4">
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-gold-400/50 mb-2">Vizyon</p>
              <p className="text-xs lg:text-sm text-text-secondary leading-relaxed">
                {'Seeking Alpha, TipRanks ve benzeri global platformlardan daha fazlasını '}
                <span className="text-text-primary font-semibold">{'Hermes AI tamamen ücretsiz ve Türkçe'}</span>{' olarak sunuyor.'}
              </p>
              <p className="mt-2 text-xs text-text-tertiary leading-relaxed">
                {'Bu yazılımı 7 yıllık bir emekle inşa ettim. Bilgiye erişimi herkese ücretsiz açmayı seçtim.'}
              </p>
            </div>

            <div className="rounded-xl border border-stroke-subtle bg-surface-2 backdrop-blur-sm px-4 py-3 lg:px-5 lg:py-4">
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-gold-400/50 mb-2">Amaç</p>
              <div className="space-y-1.5">
                {[
                  'Türk gençlerinin yanlış yatırım kararlarını doğru kararlarla değiştirmesine yardımcı olmak',
                  'Veri temelli düşünmeyi yaygınlaştırmak',
                  'Bilgiye erişimi olanın güçlü olduğu bu dünyada, gücü eşitlemek',
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-2 transition-all duration-500 ${p(4) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`} style={d(i * 150)}>
                    <div className="w-1 h-1 rounded-full bg-gold-400/40 shrink-0 mt-1.5" />
                    <span className="text-[11px] lg:text-xs text-text-secondary">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ CENTER COLUMN: Darussafaka Mission ═══ */}
          <div className={`flex items-stretch transition-all duration-1000 ${p(4) ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <div className="relative w-full rounded-2xl border border-gold-400/[0.12] bg-gradient-to-b from-amber-950/[0.08] to-transparent overflow-hidden">
              {/* Gold top accent */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />

              {/* Image */}
              <div className="relative w-full h-44 sm:h-52 lg:h-48 overflow-hidden">
                <Image
                  src="/images/hermes-darussafaka.png"
                  alt="Hermes AI ile Bir Çocuğa Işık Ol"
                  fill
                  className="object-cover object-top lantern-glow"
                  sizes="(max-width: 768px) 100vw, 350px"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent" />
              </div>

              {/* Content */}
              <div className="px-4 pb-4 lg:px-5 lg:pb-5 -mt-4 relative z-10">
                <h3 className="text-base lg:text-lg font-bold text-text-primary mb-2 leading-snug">
                  Hayatta bazı yatırımlar vardır;{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-300 to-amber-400">
                    karşılığı parayla ölçülmez.
                  </span>
                </h3>
                <p className="text-[11px] lg:text-xs text-text-tertiary leading-relaxed mb-3">
                  Kazandığımız tüm geliri, maddi imkânları sınırlı çocukların eğitimi için{' '}
                  <span className="text-gold-300/80 font-semibold">Darüşşafaka</span>&#39;ya bağışlıyoruz.
                </p>
                <p className="text-[11px] text-text-quaternary italic leading-relaxed mb-4">
                  &ldquo;Gerçek kazanç, bir çocuğun yarınlara umutla bakabilmesidir.&rdquo;
                </p>

                <a
                  href="https://fonzip.com/darussafaka/fundraising-campaigns/hermes-ai-ile-gelecege-yatirim"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600/25 via-gold-400/20 to-amber-600/25 border border-stroke-gold hover:border-gold-400/45 text-gold-300 font-bold text-xs tracking-wide transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/15 hover:scale-[1.03]"
                >
                  <span className="heart-beat">&#10084;&#65039;</span>
                  <span>Bağış Yap ve Umut Ol</span>
                  <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* ═══ RIGHT COLUMN: Neden Ucretsiz + Ekosistem + Giris ═══ */}
          <div className="flex flex-col gap-3">
            <div className={`rounded-xl border border-stroke-subtle bg-surface-2 backdrop-blur-sm px-4 py-3 lg:px-5 lg:py-4 transition-all duration-700 ${p(4) ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`}>
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-gold-400/50 mb-2">Neden Ücretsiz?</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                {'Hermes AI yalnızca ticari bir yazılım değil. '}
                <span className="text-text-primary font-medium">{'Finansal özgürlüğün herkes için mümkün olduğuna inanan bir vizyondur.'}</span>
              </p>
              <p className="mt-2 text-[11px] text-text-tertiary leading-relaxed">
                {'Kurucusu olarak zaten kazanıyorum. Platformu ücretli bir modele taşımak yerine, bilgiyi paylaşmayı seçtim.'}
              </p>
            </div>

            <div className={`rounded-xl border border-stroke-subtle bg-surface-2 backdrop-blur-sm px-4 py-3 lg:px-5 lg:py-4 transition-all duration-700 ${p(5) ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`} style={d(200)}>
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-gold-400/50 mb-1.5">Ekosistem Notu</p>
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                {'Hermes AI ekosisteminin parçası olan '}
                <span className="text-gold-400/70 font-medium">Hermes Coin</span>
                {' (BSC Smart Contract) ileride platform içi bazı premium avantajlara erişim sağlayabilir.'}
              </p>
              <code className="block mt-1.5 text-[8px] text-text-quaternary font-mono bg-surface-2 px-2 py-1 rounded select-all break-all">
                0x9495ab3549338bf14ad2f86cbcf79c7b574bba37
              </code>
            </div>

            <div className={`transition-all duration-700 ${p(5) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={d(400)}>
              <button
                onClick={handleClose}
                className="w-full group flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-gold-400/10 to-amber-500/10 border border-stroke-gold text-gold-300/90 text-sm font-bold tracking-wider hover:from-gold-400/20 hover:to-amber-500/20 hover:border-gold-400/35 hover:text-gold-300 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-gold-400/10"
              >
                Platforma Giriş Yap
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom close */}
        <div className={`mt-5 lg:mt-7 text-center transition-all duration-700 ${p(6) ? 'opacity-100' : 'opacity-0'}`} style={d(200)}>
          <button onClick={handleClose} className="text-xs text-text-quaternary hover:text-text-secondary transition-colors duration-300 tracking-widest uppercase px-4 py-2 rounded-lg border border-stroke-subtle hover:border-stroke hover:bg-surface-2">
            Kapat &times;
          </button>
        </div>
      </div>
    </div>
  )
}
