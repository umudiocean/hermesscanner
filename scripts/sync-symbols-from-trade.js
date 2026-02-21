#!/usr/bin/env node
// data/symbols.json'i Trade AI tarafindan desteklenen hisselerle gunceller
// Kullanim: node scripts/sync-symbols-from-trade.js [trade_ready.json]
// trade_ready.json: /api/admin/symbols-sync'dan indirilen tradeReady array'i iceren dosya
// Ornek: { "tradeReady": ["A","AA",...], "insufficient": [...] }

const fs = require('fs')
const path = require('path')

const symbolsPath = path.join(__dirname, '../data/symbols.json')
const inputPath = process.argv[2] || path.join(__dirname, '../data/trade_ready.json')

if (!fs.existsSync(inputPath)) {
  console.error('Dosya bulunamadi:', inputPath)
  console.error('Kullanim: node scripts/sync-symbols-from-trade.js trade_ready.json')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
const tradeReady = data.tradeReady || data
const symbols = Array.isArray(tradeReady) ? tradeReady : []

if (symbols.length === 0) {
  console.error('tradeReady array bos veya gecersiz format')
  process.exit(1)
}

fs.writeFileSync(symbolsPath, JSON.stringify(symbols.sort(), null, 2), 'utf-8')
console.log(`symbols.json guncellendi: ${symbols.length} hisse`)
if (data.insufficient?.length) {
  console.log(`Cikarilan (FMP veri yetersiz): ${data.insufficient.length} hisse`)
}
