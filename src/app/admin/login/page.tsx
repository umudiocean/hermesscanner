'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'

export default function AdminLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        router.push('/admin')
      } else {
        setError('Gecersiz kullanici adi veya sifre')
      }
    } catch {
      setError('Baglanti hatasi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4B86A]/20 to-[#D4B86A]/5 border border-[#D4B86A]/30 mb-4">
            <Shield className="w-8 h-8 text-[#D4B86A]" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">HERMES AI</h1>
          <p className="text-text-tertiary text-sm mt-1">Admin Panel</p>
        </div>

        <form onSubmit={handleLogin} className="bg-surface-3 rounded-2xl border border-white/8 p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
              Kullanici Adi
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Kullanici adinizi girin"
              className="w-full bg-surface-1 border border-stroke rounded-xl px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#D4B86A]/50 transition-colors"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
              Sifre
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Sifrenizi girin"
              className="w-full bg-surface-1 border border-stroke rounded-xl px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#D4B86A]/50 transition-colors"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-danger-400 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-gradient-to-r from-[#D4B86A] to-[#8B7340] hover:from-[#C4A56C] hover:to-[#9C8451] text-black font-semibold rounded-xl px-4 py-3 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Giris yapiliyor...' : 'Giris Yap'}
          </button>
        </form>

        <p className="text-center text-text-tertiary text-[10px] mt-6">
          Yetkisiz erisim izlenmektedir
        </p>
      </div>
    </div>
  )
}
