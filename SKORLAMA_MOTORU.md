# HERMES AI — Hisse Skorlama Motoru Dokümantasyonu

> **Motor:** `src/lib/fmp-terminal/fmp-score-engine.ts` (V6, 1059 satır)
> **Veri kaynağı:** FMP API (Financial Modeling Prep)
> **Çıktı:** Her hisse için `PUAN (0-100)` + `GÜVEN (0-100)` + `SİNYAL` + `BADGE'ler` + `RED FLAG'ler`
> **Son güncelleme:** 2026-04-24

---

## 1. Genel Mimari

Bir hisse 8 ayrı kategoride 0-100 arası puanlanır. Her kategori sektöre özel ağırlıkla
çarpılıp **ağırlıklı ortalama** alınır → tek bir kompozit **PUAN** çıkar. Üstüne **GÜVEN**
skoru hesaplanır (veri ne kadar dolu/güncel). Sert kapaklar (gate) iflas riski veya
çok sayıda red flag varsa puanı sınırlar.

```
FMP ham veri
   │
   ▼
[ScoreInputMetrics] (40+ metrik normalize edilir)
   │
   ├─ scoreValuation()    →  0-100
   ├─ scoreHealth()       →  0-100  (+ red flags)
   ├─ scoreGrowth()       →  0-100
   ├─ scoreAnalyst()      →  0-100
   ├─ scoreQuality()      →  0-100
   ├─ scoreMomentum()     →  0-100
   ├─ scoreSector()       →  0-100
   └─ scoreSmartMoney()   →  0-100  (+ red flags)
   │
   ▼
Sektör ağırlıkları (getSectorWeights) → ağırlıklı ortalama
   │
   ▼
GATE'ler (Altman Z < 1.8 → max 50, red flag cap)
   │
   ▼
PUAN (0-100) + 3D GÜVEN + SİNYAL + BADGE + OVERVALUATION
```

---

## 2. 8 Kategori ve Ağırlıkları

### Varsayılan ağırlıklar (`WEIGHTS`)

| Kategori | Ağırlık | Açıklama |
|----------|---------|----------|
| Valuation (Değerleme) | **0.25** | En yüksek — ucuz mu pahalı mı |
| Health (Finansal Sağlık) | **0.20** | İflas/borç riski |
| Growth (Büyüme) | **0.14** | Gelir/EPS/net kâr büyümesi |
| Analyst (Analist) | **0.11** | Wall Street konsensüsü |
| Quality (Kalite) | **0.10** | Sermaye verimliliği |
| Momentum | **0.10** | Fiyat/hacim trendi |
| Sector (Sektör) | **0.05** | Sektör rüzgârı |
| Smart Money | **0.05** | İçeriden + kurumsal + kongre |
| **TOPLAM** | **1.00** | |

### Sektör override'ları (`SECTOR_WEIGHT_OVERRIDES`)

Sadece yüksek farklılaşma gereken sektörler override edilir, gerisi varsayılanı kullanır:

| Sektör | Değişen ağırlıklar |
|--------|---------------------|
| Technology | valuation 0.18, growth 0.20, quality 0.15, momentum 0.12 |
| Financial Services | valuation 0.22, health 0.25, quality 0.12, growth 0.10 |
| Real Estate | valuation 0.18, health 0.22, quality 0.08, momentum 0.15 |
| Energy | valuation 0.20, health 0.22, quality 0.12, momentum 0.12 |
| Healthcare | valuation 0.20, growth 0.20, quality 0.12, health 0.18 |

> Override sonrası ağırlıklar toplamı 1.0'dan saparsa otomatik yeniden normalize edilir.

---

## 3. Matematiksel Yöntemler

Her metrik 0-100 skalasına 3 yöntemden biriyle çevrilir:

### `percentileRank(value, values, lowerIsBetter)`
Sektör emsallerine göre yüzdelik dilim. **En adil yöntem** — emsal verisi (>5 hisse) varsa kullanılır.
- P1/P99 ile aykırı değerler kırpılır (clip)
- Örn: P/E'n sektörün en ucuz %20'sindeyse ve `lowerIsBetter=true` → ~80 puan

### `sigmoid(value, center, steepness)`
Emsal yoksa mutlak eşiğe göre S-eğrisi.
- `center`: 50 puana denk gelen değer
- `steepness`: eğrinin dikliği (negatif = düşük değer iyi)
- Örn: `sigmoid(pe, 25, -0.1)` → P/E 25'te 50 puan, düşükse yüksek puan

### `piecewise(value, breakpoints)`
Kademeli eşik tablosu (Altman Z, Piotroski gibi).
- Örn: `[[0,0],[1.1,10],[1.8,30],[3.0,70],[5.0,95],[10,100]]`

---

## 4. Kategori Detayları

### 4.1 Valuation (Değerleme) — 8 alt metrik

| # | Metrik | Yöntem |
|---|--------|--------|
| 1 | P/E vs sektör | percentileRank (düşük iyi) → fallback sigmoid(25, -0.1) |
| 2 | P/B vs sektör | percentileRank → fallback sigmoid(3, -0.5) |
| 3 | EV/EBITDA vs sektör | percentileRank → fallback sigmoid(15, -0.15) |
| 4 | DCF Upside | sigmoid + **güvenilirlik filtresi** (>%300 sapma → 0.3x, FCF<0 → 0.5x) |
| 5 | PEG | sigmoid(1.5, -1.5) — sadece epsGrowth > 0 ise |
| 6 | FCF Yield | sigmoid(4, 0.5) — `100/pfcf` |
| 7 | 52W Pozisyon | dipte = yüksek puan (`100 - position*100`) |
| 8 | P/S sektör | percentileRank |

Skor = dolu olan metriklerin ortalaması.

### 4.2 Health (Finansal Sağlık) — 6 alt metrik + red flag

| # | Metrik | Not |
|---|--------|-----|
| 1 | **Altman Z** | Sektöre duyarlı (aşağıda). Z<1.8 → kritik red flag |
| 2 | Piotroski F-Score | 0-9, piecewise |
| 3 | Borç/Özkaynak | sigmoid(1.5, -1.0). >5 → red flag (aşırı borçlu) |
| 4 | Cari Oran | 2.0'a yakınlık ideal |
| 5 | Faiz Karşılama | piecewise (yüksek iyi) |
| 6 | FCF/Pay | negatifse red flag (nakit yakıyor) |

#### Altman Z — Sektöre Duyarlı Eşikler
- **Finans** (`FINANCE_SECTORS`): farklı tablo (bankalar yüksek kaldıraçlı)
- **REIT** (`REIT_SECTORS`): gayrimenkul kendine has
- **Growth** (`GROWTH_SECTORS`: Tech, Comm, Healthcare, Biotech): düşük Z toleranslı
- **Standart**: klasik [[0,0],[1.1,10],[1.8,30],[3.0,70],[5.0,95]]
- **Z=0 / veri yok**: likidite + borç + faiz + FCF'den hızlı fallback skor

### 4.3 Growth (Büyüme) — 3 alt metrik
Gelir büyümesi `sigmoid(10, 0.08)`, EPS büyümesi `sigmoid(15, 0.06)`, net kâr `sigmoid(10, 0.06)`.

### 4.4 Analyst (Analist) — 5 alt metrik (iç ağırlıklı)

| # | Metrik | İç ağırlık |
|---|--------|-----------|
| 1 | Buy oranı (strongBuy+buy)/toplam | 0.25 |
| 2 | Fiyat hedefi upside | 0.25 |
| 3 | Konsensüs etiketi (Strong Buy=95...Strong Sell=5) | 0.15 |
| 4 | **EPS revizyon momentumu** (30g %65 + 90g %35) | 0.30 |
| 5 | Kapsama derinliği (kaç analist) | 0.05 |

### 4.5 Quality (Kalite) — 3 alt metrik
ROIC `sigmoid(12, 0.12)`, Brüt marj `sigmoid(40, 0.08)`, FCF/Net kâr `sigmoid(0.8, 2.0)`.

### 4.6 Momentum — 4 alt metrik (iç ağırlıklı)

| # | Metrik | İç ağırlık |
|---|--------|-----------|
| 1 | 1A fiyat değişimi | 0.30 |
| 2 | 6A fiyat değişimi | 0.30 |
| 3 | Hacim oranı (hacim>2x + yükseliş = 85) | 0.20 |
| 4 | 52W relatif güç | 0.20 |

### 4.7 Sector (Sektör) — 1 metrik
Sektörün son 1 aylık performansı `sigmoid(0, 0.3)`. Veri yoksa 50.

### 4.8 Smart Money — birleşik (insider + kurumsal + kongre)
- **İçeriden (~%60):** clusterBuy=95, cSuiteBuying=90, net alım/değer sigmoid. Büyük net satış → red flag
- **Kurumsal:** sahiplik %30-80 ideal, >%80 aşırı kalabalık (45 puan)
- **Kongre:** kongre üyesi alımları, çoklu işlem +20 bonus

---

## 5. Final Kompozit Skor

```ts
// 1. Sadece veri olan kategoriler alınır
withData = catEntries.filter(c => c.dp > 0)

// 2. Aktif ağırlıklar yeniden normalize edilir
totalActiveWeight = Σ sectorW[kategori]

// 3. Ağırlıklı ortalama
rawTotal = Σ (score * sectorW[k] / totalActiveWeight)

// 4. Stretch factor — veri doluluğuna göre 50'den uzaklaşma
dataRatio = withData.length / 8
stretchFactor = 1.0 + dataRatio * 0.5   // tam veri → 1.5x
total = 50 + (rawTotal - 50) * stretchFactor
```

> **Mantık:** Eksik verili hisse 50'ye yapışık kalır (güvenilmez), tam verili hisse
> gerçek skorunu gösterir.

### Sert Kapaklar (Gate'ler)
| Kural | Etki |
|-------|------|
| Altman Z < 1.8 (Finans/REIT hariç) | total **max 50** (iflas riski) |
| 5+ red flag | total **max 50** |
| 3+ red flag | total **max 65** |
| Negatif P/E | red flag (zarar ediyor) |

---

## 6. Sinyal Seviyeleri

`getScoreLevel(score)`:

| Puan | Sinyal | UI Rengi |
|------|--------|----------|
| 75-100 | **STRONG** (Güçlü) | Sarı/Altın |
| 60-74 | **GOOD** (İyi) | Yeşil |
| 40-59 | **NEUTRAL** (Nötr) | Gri |
| 25-39 | **WEAK** (Zayıf) | Turuncu |
| 0-24 | **BAD** (Kötü) | Kırmızı |

---

## 7. GÜVEN (3 Boyutlu Confidence)

`compute3DConfidence()`:

```
coverage    = (dolu veri noktaları / toplam mümkün) * 100      → ağırlık 0.40
consistency = (kritik 5 veriden kaçı var) * 100                → ağırlık 0.35
              [pe, altmanZ, analystConsensus, price, growth]
freshness   = güncel fiyat+marketCap varsa 80, yoksa 40        → ağırlık 0.25

GÜVEN = coverage*0.40 + consistency*0.35 + freshness*0.25   (30-100 arası clamp)
```

- **GÜVEN < %50** → `isDegraded = true` (veri eksik, dikkatli yaklaş)
- **GÜVEN ≥ %75** → "YÜKSEK GÜVEN" badge
- **GÜVEN ≤ %45** → "DÜŞÜK GÜVEN" badge

---

## 8. Overvaluation Motoru (Short Sinyali)

`computeOvervaluationScore()` — 0 (ucuz) → 100 (aşırı pahalı):

| Bileşen | Ağırlık | Tetikleyici |
|---------|---------|-------------|
| Değerleme tersi | %35 | Düşük valuation skoru → PAHALI_DEGERLEME |
| Momentum kırılması | %25 | 6A↑ + 1A↓ → MOMENTUM_KIRILMA |
| Earnings miss | %15 | 2+ miss → KAZANC_MISS_2Q+ |
| İnsider satış | %15 | >$2M net satış → INSIDER_SATIS |
| Short float | %10 | >%10 short interest (squeeze guard ile) |

Seviye: LOW (<30) / MEDIUM (30-49) / HIGH (50-69) / EXTREME (70+)

---

## 9. Badge Sistemi

| Badge | Koşul |
|-------|-------|
| KAZANÇ GÜÇLÜ | son 4Ç 3+ beat |
| KAZANÇ ZAYIF | son 4Ç 2+ miss |
| AKIN YÜKSELİŞ/DÜŞÜŞ | hacim >2x + \|%değişim\| > 3 |
| BUBBLE RİSKİ | EXTREME overval + 52W tepe yakını (>%90) |
| SQUEEZE RİSKİ | short float >%15 + 1A yükseliş >%5 |
| HEDEF +X% | analist hedefi %30+ upside |
| YÜKSEK/DÜŞÜK GÜVEN | confidence ≥75 / ≤45 |

---

## 10. UI Filtreleri (Hisseler Tablosu)

| Filtre | Seçenekler |
|--------|-----------|
| **Market Cap** | Tümü / MEGA (>$200B) / LARGE / MID / SMALL / MICRO / Watchlist |
| **GÜVEN** | Tümü / %70+ / %50-69 / <%50 |
| **FİYATLANMA** | Çok Ucuz / Ucuz / Normal / Pahalı / Çok Pahalı |
| **SİNYAL** | Tümü / Güçlü / İyi / Notr / Zayıf / Kötü |

**Tablo kolonları:** Sembol · Şirket · Sektör · Sinyal · Puan · Güven · Fiyat · Değişim ·
Piyasa Değeri · F/K · Altman Z · F-Skor · DCF% · REV30 · REV90 · ROE% · Borç/Öz · Risk ·
Fiyatlama · Overval

---

## 11. Örnek Akış (Tek Hisse)

```
AAPL (Technology sektörü)
  │
  ├─ Sektör ağırlıkları: valuation 0.18, growth 0.20, quality 0.15...
  │
  ├─ Valuation: P/E sektör emsali percentile → 62
  ├─ Health:    Altman Z 6.2 (Growth tablosu) → 95
  ├─ Growth:    EPS +15% → 75
  ├─ Analyst:   28 analist, %75 buy, +12% hedef → 80
  ├─ Quality:   ROIC %45 → 92
  ├─ Momentum:  6A +18%, hacim normal → 68
  ├─ Sector:    Tech +3% → 65
  └─ SmartMoney: kurumsal %62 → 70
  │
  ▼
Ağırlıklı ortalama → ~74 (stretch ile)
GATE kontrol: Altman Z OK, red flag yok → değişmez
  │
  ▼
PUAN: 74 → SİNYAL: GOOD (İyi)
GÜVEN: 88 (tam veri) → YÜKSEK GÜVEN badge
```

---

## 12. İlgili Dosyalar

| Dosya | Görev |
|-------|-------|
| `src/lib/fmp-terminal/fmp-score-engine.ts` | Skorlama motoru (bu doküman) |
| `src/lib/fmp-terminal/fmp-types.ts` | Tipler, eşikler, sinyal seviyeleri |
| `src/lib/fmp-terminal/fmp-normalizer.ts` | FMP ham veri → ScoreInputMetrics |
| `src/lib/fmp-terminal/fmp-bulk-client.ts` | FMP bulk API çağrıları |
| `src/lib/fmp-terminal/fmp-cache.ts` | Redis cache |
| `src/components/modules/nasdaq-terminal/TabStocks.tsx` | Hisseler tablosu UI |
| `src/app/api/fmp-terminal/stocks/route.ts` | API endpoint |

---

*Bu doküman motorun mevcut V6 halini yansıtır. Ağırlıklar veya eşikler değişirse güncellenmelidir.*
