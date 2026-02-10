// ═══════════════════════════════════════════════════════════════════
// NASDAQ Market Hours Utility
// Seans: 9:30 AM - 4:00 PM Eastern Time (ET), Pazartesi-Cuma
// Tatil gunleri kontrol edilmez (veri gelmezse refresh no-op olur)
// ═══════════════════════════════════════════════════════════════════

/**
 * Suanki zamani Eastern Time (New York) olarak al
 */
function getNowET(): { hour: number; minute: number; dayOfWeek: number; date: Date } {
  const now = new Date()
  // Intl.DateTimeFormat ile ET saatini al
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const etDate = new Date(etStr)
  return {
    hour: etDate.getHours(),
    minute: etDate.getMinutes(),
    dayOfWeek: etDate.getDay(), // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
    date: etDate,
  }
}

/**
 * NASDAQ borsasi acik mi?
 * Pazartesi-Cuma, 9:30 AM - 4:00 PM ET
 */
export function isMarketOpen(): boolean {
  const { hour, minute, dayOfWeek } = getNowET()

  // Hafta sonu
  if (dayOfWeek === 0 || dayOfWeek === 6) return false

  // 9:30 AM - 4:00 PM ET arasi
  const timeInMinutes = hour * 60 + minute
  const openTime = 9 * 60 + 30   // 9:30 = 570
  const closeTime = 16 * 60       // 16:00 = 960

  return timeInMinutes >= openTime && timeInMinutes < closeTime
}

/**
 * Bir sonraki seans acilisina kalan sure (ms)
 * Eger seans aciksa 0 doner
 */
export function getTimeUntilOpen(): number {
  if (isMarketOpen()) return 0

  const { hour, minute, dayOfWeek, date } = getNowET()
  const timeInMinutes = hour * 60 + minute
  const openTime = 9 * 60 + 30

  // Bugun haftaici ve seans henuz acilmamissa
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && timeInMinutes < openTime) {
    return (openTime - timeInMinutes) * 60 * 1000
  }

  // Bugun seans kapandiysa veya hafta sonu ise, sonraki is gununu bul
  const nextOpen = new Date(date)
  
  if (dayOfWeek === 5 && timeInMinutes >= 960) {
    // Cuma kapanmis, Pazartesi
    nextOpen.setDate(nextOpen.getDate() + 3)
  } else if (dayOfWeek === 6) {
    // Cumartesi, Pazartesi
    nextOpen.setDate(nextOpen.getDate() + 2)
  } else if (dayOfWeek === 0) {
    // Pazar, Pazartesi
    nextOpen.setDate(nextOpen.getDate() + 1)
  } else {
    // Haftaici kapanmis, yarin
    nextOpen.setDate(nextOpen.getDate() + 1)
  }

  nextOpen.setHours(9, 30, 0, 0)
  return nextOpen.getTime() - date.getTime()
}

/**
 * Seans kapanisina kalan sure (ms)
 * Eger seans kapali ise 0 doner
 */
export function getTimeUntilClose(): number {
  if (!isMarketOpen()) return 0

  const { hour, minute } = getNowET()
  const timeInMinutes = hour * 60 + minute
  const closeTime = 16 * 60 // 16:00

  return (closeTime - timeInMinutes) * 60 * 1000
}

/**
 * Sonraki seans acilisi tarihini dondur (ET)
 */
export function getNextMarketOpen(): Date {
  const { dayOfWeek, date, hour, minute } = getNowET()
  const timeInMinutes = hour * 60 + minute
  const openTime = 9 * 60 + 30

  const nextOpen = new Date(date)

  // Bugun haftaici ve seans henuz acilmamissa
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && timeInMinutes < openTime) {
    nextOpen.setHours(9, 30, 0, 0)
    return nextOpen
  }

  // Sonraki is gununu bul
  if (dayOfWeek === 5) {
    nextOpen.setDate(nextOpen.getDate() + 3) // Pazartesi
  } else if (dayOfWeek === 6) {
    nextOpen.setDate(nextOpen.getDate() + 2) // Pazartesi
  } else if (dayOfWeek === 0) {
    nextOpen.setDate(nextOpen.getDate() + 1) // Pazartesi
  } else {
    nextOpen.setDate(nextOpen.getDate() + 1) // Yarin
  }

  nextOpen.setHours(9, 30, 0, 0)
  return nextOpen
}

/**
 * Market durumu bilgisi (UI icin)
 */
export function getMarketStatus(): {
  isOpen: boolean
  label: string
  nextEvent: string
} {
  const open = isMarketOpen()

  if (open) {
    const msUntilClose = getTimeUntilClose()
    const minsLeft = Math.floor(msUntilClose / 60000)
    const hours = Math.floor(minsLeft / 60)
    const mins = minsLeft % 60
    return {
      isOpen: true,
      label: 'Seans Acik',
      nextEvent: `Kapanisa ${hours}s ${mins}dk`,
    }
  }

  const msUntilOpen = getTimeUntilOpen()
  const minsLeft = Math.floor(msUntilOpen / 60000)
  
  if (minsLeft < 60) {
    return {
      isOpen: false,
      label: 'Seans Kapali',
      nextEvent: `Acilisa ${minsLeft}dk`,
    }
  }

  const hours = Math.floor(minsLeft / 60)
  const mins = minsLeft % 60
  if (hours < 24) {
    return {
      isOpen: false,
      label: 'Seans Kapali',
      nextEvent: `Acilisa ${hours}s ${mins}dk`,
    }
  }

  const days = Math.floor(hours / 24)
  return {
    isOpen: false,
    label: 'Seans Kapali',
    nextEvent: `Acilisa ${days} gun`,
  }
}
