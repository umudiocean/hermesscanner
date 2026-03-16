// Lightweight i18n stub for Hermes Scanner
// Only Turkish is used in this app

import { useState, useCallback } from 'react'

type Language = 'tr' | 'en'

export function useLanguage() {
  const [language, setLanguage] = useState<Language>('tr')
  const toggleLanguage = useCallback(() => {
    setLanguage(prev => prev === 'tr' ? 'en' : 'tr')
  }, [])
  return { language, setLanguage, toggleLanguage }
}
