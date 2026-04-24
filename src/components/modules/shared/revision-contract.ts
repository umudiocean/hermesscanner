export const REVISION_TOOLTIPS = {
  rev30: 'EPS REV30: Son 30 gunde analist ortalama EPS tahminindeki yuzdesel revizyon.',
  rev90: 'EPS REV90: Son 90 gunde analist ortalama EPS tahminindeki yuzdesel revizyon.',
} as const

export const CSV_HEADERS = {
  nasdaqSignals: 'Symbol,Sector,Best Signal,N.Teknik,Teknik Score,H.AI,AI Score,Guven%,Rev30%,Rev90%,Fiyatlama,Price,Change%,MarketCap',
  nasdaqWatchlist: 'Symbol,Segment,Price,Change%,Terminal AI,Trade AI,AI Signal,Skor,RSI,MFI,Guven%,Rev30%,Rev90%,Fiyatlama,Risk,MCap,52W,Z',
} as const
