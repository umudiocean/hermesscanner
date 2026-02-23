'use client'

import { useState, useEffect, useRef } from 'react'

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
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
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
        ctx.globalAlpha = 0.15
        ctx.fillStyle = '#fff'
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
    <div className={`fixed inset-0 z-[100] bg-black transition-all duration-600 overflow-y-auto overflow-x-hidden ${closing ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>

      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.015] blur-[150px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-[20%] left-[15%] w-[200px] h-[200px] rounded-full bg-white/[0.01] blur-[80px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-[15%] right-[10%] w-[250px] h-[250px] rounded-full bg-white/[0.008] blur-[90px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-manifesto-scan" />
        <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-white/[0.03] to-transparent" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-8 lg:px-12 py-16">

        {/* Mobile close button — always visible at top-right */}
        <button
          onClick={handleClose}
          className="fixed top-4 right-4 z-[110] w-10 h-10 flex items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.15] text-white/60 hover:text-white hover:bg-white/[0.15] transition-all duration-300"
          aria-label="Kapat"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Logo + Title */}
        <div className={`flex items-center gap-3 mb-6 lg:mb-8 transition-all duration-700 ${p(1) ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center animate-manifesto-logo-pulse">
            <svg className="w-6 h-6 lg:w-7 lg:h-7" viewBox="0 0 32 32" fill="none">
              <path d="M4 22 L8.5 17 L13 19.5 L18 13 L22.5 16 L28 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              <circle cx="16" cy="7" r="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="6" cy="10" r="1.5" fill="rgba(255,255,255,0.3)" />
              <circle cx="26" cy="12" r="1.5" fill="rgba(255,255,255,0.3)" />
              <line x1="6" y1="10" x2="16" y2="7" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
              <line x1="16" y1="7" x2="26" y2="12" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
            </svg>
          </div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white leading-none">
            HERMES <span className="text-white/50">AI</span>
          </h1>
        </div>

        {/* Hero Statement */}
        <div className={`text-center mb-5 lg:mb-7 max-w-4xl transition-all duration-800 ${p(2) ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight uppercase">
            {'Türk kullanıcılar için tasarlanan bu platform tamamen '}
            <span className="text-red-400">{'ücretsizdir.'}</span>
          </h2>
          <p className="mt-2 text-sm sm:text-base lg:text-lg text-white/70 font-medium tracking-wide uppercase">
            {'ChatGPT, Claude, Kimi ve Gemini gücüyle, '}
            <span className="text-red-400">{'%100 yapay zeka'}</span>
            {' desteklidir.'}
          </p>
        </div>

        {/* Animated Divider */}
        <div className={`mb-5 lg:mb-7 transition-all duration-1000 ${p(2) ? 'opacity-100' : 'opacity-0'}`}>
          <div className="relative flex items-center gap-3">
            <div className={`h-[1px] bg-gradient-to-r from-transparent to-white/30 transition-all duration-1000 ${p(2) ? 'w-16 lg:w-24' : 'w-0'}`} />
            <div className={`w-1.5 h-1.5 rounded-full bg-white/40 transition-all duration-500 ${p(2) ? 'scale-100' : 'scale-0'}`} style={d(400)} />
            <div className={`h-[1px] bg-gradient-to-l from-transparent to-white/30 transition-all duration-1000 ${p(2) ? 'w-16 lg:w-24' : 'w-0'}`} />
          </div>
        </div>

        {/* 3-Column Horizontal Layout */}
        <div className={`w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 transition-all duration-800 ${p(3) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Left Column */}
          <div className="flex flex-col gap-2 lg:gap-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-4 py-3 lg:px-5 lg:py-4">
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/40 mb-2">Vizyon</p>
              <p className="text-xs lg:text-sm text-white/70 leading-relaxed">
                {'Seeking Alpha, TipRanks ve benzeri global platformlardan daha fazlasını '}
                <span className="text-white font-semibold">{'Hermes AI tamamen ücretsiz ve Türkçe'}</span>{' olarak sunuyor.'}
              </p>
              <p className="mt-2 text-xs text-white/60 leading-relaxed">
                {'Bu yazılımı 7 yıllık bir emekle inşa ettim. Bilgiye erişimi herkese ücretsiz açmayı seçtim.'}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-4 py-3 lg:px-5 lg:py-4">
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/40 mb-2">{'Amaç'}</p>
              <div className="space-y-1.5">
                {[
                  'Türk gençlerinin yanlış yatırım kararlarını doğru kararlarla değiştirmesine yardımcı olmak',
                  'Veri temelli düşünmeyi yaygınlaştırmak',
                  'Bilgiye erişimi olanın güçlü olduğu bir dünyada, gücü eşitlemek',
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 transition-all duration-500 ${p(4) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`} style={d(i * 150)}>
                    <div className="w-1 h-1 rounded-full bg-white/40 shrink-0" />
                    <span className="text-[11px] lg:text-xs text-white/60">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center Column — Slogan */}
          <div className={`flex items-center justify-center transition-all duration-1000 ${p(4) ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <div className="relative w-full">
              <div className="absolute -inset-4 bg-white/[0.02] rounded-2xl blur-2xl animate-pulse" style={{ animationDuration: '4s' }} />
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-white/[0.1] via-transparent to-white/[0.06] animate-manifesto-border-spin" />
              <div className="relative rounded-2xl border border-white/[0.1] bg-black/80 backdrop-blur-md px-5 py-6 lg:px-6 lg:py-8 text-center">
                <div className="animate-manifesto-text-glow">
                  <p className="text-lg sm:text-xl lg:text-2xl font-black text-white leading-snug tracking-tight">
                    {'Veriye hükmeden,'}
                  </p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-black text-white/80 leading-snug tracking-tight">
                    {'paraya hükmeder.'}
                  </p>
                </div>
                <div className="mt-3 h-[1px] w-12 mx-auto bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <p className="mt-3 text-sm lg:text-base text-white/60 font-medium">
                  {'Hermes AI ile güç artık '}<span className="text-white/90 font-bold">{'herkesin.'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-2 lg:gap-3">
            <div className={`rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-4 py-3 lg:px-5 lg:py-4 transition-all duration-700 ${p(4) ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`}>
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/40 mb-2">{'Neden Ücretsiz?'}</p>
              <p className="text-xs text-white/60 leading-relaxed">
                {'Çünkü Hermes AI yalnızca ticari bir yazılım değil. '}
                <span className="text-white/90 font-medium">{'Finansal özgürlüğün herkes için mümkün olduğuna inanan bir vizyondur.'}</span>
              </p>
              <p className="mt-2 text-[11px] text-white/50 leading-relaxed">
                {'Kurucusu olarak zaten kazanıyorum. Platformu ücretli bir modele taşımak yerine, bilgiyi paylaşmayı seçtim.'}
              </p>
            </div>

            <div className={`rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-4 py-3 lg:px-5 lg:py-4 transition-all duration-700 ${p(5) ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`} style={d(200)}>
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/40 mb-1.5">Ekosistem Notu</p>
              <p className="text-[11px] text-white/65 leading-relaxed">
                {'Hermes AI ekosisteminin parçası olan '}
                <span className="text-white/80 font-medium">Hermes Coin</span>
                {' (BSC Smart Contract) ileride platform içi bazı premium avantajlara erişim sağlayabilir.'}
              </p>
              <code className="block mt-1.5 text-[8px] text-white/40 font-mono bg-white/[0.04] px-2 py-1 rounded select-all break-all">
                0x9495ab3549338bf14ad2f86cbcf79c7b574bba37
              </code>
              <p className="mt-1.5 text-[10px] text-white/40 italic">
                {'Detaylar ilerleyen süreçte resmi olarak duyurulacaktır.'}
              </p>
            </div>

            <div className={`transition-all duration-700 ${p(5) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={d(400)}>
              <button
                onClick={handleClose}
                className="w-full group flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/[0.08] border border-white/[0.18] text-white/80 text-sm font-bold tracking-wider hover:bg-white/[0.16] hover:text-white hover:border-white/35 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-white/5"
              >
                {'Platforma Giriş Yap'}
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className={`mt-4 lg:mt-6 text-center transition-all duration-700 ${p(5) ? 'opacity-100' : 'opacity-0'}`} style={d(600)}>
          <button onClick={handleClose} className="text-xs text-white/50 hover:text-white/70 transition-colors duration-300 tracking-widest uppercase px-4 py-2 rounded-lg border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]">
            Kapat &times;
          </button>
        </div>
      </div>
    </div>
  )
}
