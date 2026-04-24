#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# HERMES — Legacy → Premium Token Migration
# Surgical sed pass over all .tsx files (except ui/, shell/, *-redesigned)
# ═══════════════════════════════════════════════════════════════════

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"

# Files to process: all .tsx in src/components & src/app, except already-modern UI primitives
FILES=$(find "$SRC" \
  \( -name "*.tsx" -o -name "*.ts" \) \
  -not -path "*/ui/*" \
  -not -path "*/shell/*" \
  -not -name "design-tokens.ts" \
  -not -name "cn.ts")

count=0
for f in $FILES; do
  count=$((count + 1))

  # ─── Surface backgrounds ────────────────────────────────────────
  sed -i \
    -e 's/bg-midnight-50\b/bg-surface-3/g' \
    -e 's/bg-midnight-100\b/bg-surface-2/g' \
    -e 's/bg-midnight-200\b/bg-surface-2/g' \
    -e 's/bg-midnight-300\b/bg-surface-2/g' \
    -e 's/bg-midnight-400\b/bg-surface-1/g' \
    -e 's/bg-midnight-500\b/bg-surface-1/g' \
    -e 's/bg-midnight-600\b/bg-surface-0/g' \
    -e 's/bg-midnight-700\b/bg-surface-0/g' \
    -e 's/bg-midnight-800\b/bg-surface-0/g' \
    -e 's/bg-midnight-900\b/bg-surface-0/g' \
    "$f"

  # ─── Hardcoded hex backgrounds ──────────────────────────────────
  sed -i \
    -e 's/bg-\[#0d0d0d\]/bg-surface-0/g' \
    -e 's/bg-\[#0D0D0D\]/bg-surface-0/g' \
    -e 's/bg-\[#0a0a0a\]/bg-surface-0/g' \
    -e 's/bg-\[#0a0a0f\]/bg-surface-0/g' \
    -e 's/bg-\[#0c0c0c\]/bg-surface-0/g' \
    -e 's/bg-\[#060606\]/bg-surface-0/g' \
    -e 's/bg-\[#1A1A1A\]/bg-surface-2/g' \
    -e 's/bg-\[#1a1a1a\]/bg-surface-2/g' \
    -e 's/bg-\[#1a1a2e\]/bg-surface-2/g' \
    -e 's/bg-\[#111111\]/bg-surface-1/g' \
    -e 's/bg-\[#151515\]/bg-surface-1/g' \
    -e 's/bg-\[#1e2028\]/bg-surface-3/g' \
    -e 's/bg-\[#151520\]/bg-surface-3/g' \
    -e 's/bg-\[#242424\]/bg-surface-3/g' \
    "$f"

  # ─── Text white/X opacity → semantic text scale ─────────────────
  sed -i \
    -e 's|text-white/8\b|text-text-quaternary|g' \
    -e 's|text-white/10\b|text-text-quaternary|g' \
    -e 's|text-white/12\b|text-text-quaternary|g' \
    -e 's|text-white/15\b|text-text-quaternary|g' \
    -e 's|text-white/20\b|text-text-quaternary|g' \
    -e 's|text-white/25\b|text-text-quaternary|g' \
    -e 's|text-white/30\b|text-text-quaternary|g' \
    -e 's|text-white/35\b|text-text-quaternary|g' \
    -e 's|text-white/40\b|text-text-tertiary|g' \
    -e 's|text-white/45\b|text-text-tertiary|g' \
    -e 's|text-white/50\b|text-text-tertiary|g' \
    -e 's|text-white/55\b|text-text-secondary|g' \
    -e 's|text-white/60\b|text-text-secondary|g' \
    -e 's|text-white/65\b|text-text-secondary|g' \
    -e 's|text-white/70\b|text-text-secondary|g' \
    -e 's|text-white/75\b|text-text-primary|g' \
    -e 's|text-white/80\b|text-text-primary|g' \
    -e 's|text-white/85\b|text-text-primary|g' \
    -e 's|text-white/90\b|text-text-primary|g' \
    -e 's|text-white/95\b|text-text-primary|g' \
    "$f"

  # ─── Border white/X → semantic stroke ───────────────────────────
  sed -i \
    -e 's|border-white/\[0\.04\]|border-stroke-subtle|g' \
    -e 's|border-white/\[0\.05\]|border-stroke-subtle|g' \
    -e 's|border-white/\[0\.06\]|border-stroke-subtle|g' \
    -e 's|border-white/\[0\.08\]|border-stroke|g' \
    -e 's|border-white/\[0\.1\]|border-stroke|g' \
    -e 's|border-white/\[0\.12\]|border-stroke|g' \
    -e 's|border-white/\[0\.15\]|border-stroke|g' \
    -e 's|border-white/10\b|border-stroke|g' \
    -e 's|border-white/15\b|border-stroke|g' \
    -e 's|border-white/20\b|border-stroke-strong|g' \
    "$f"

  # ─── BG white/X opacity → surface tones ─────────────────────────
  sed -i \
    -e 's|bg-white/\[0\.02\]|bg-surface-2|g' \
    -e 's|bg-white/\[0\.03\]|bg-surface-2|g' \
    -e 's|bg-white/\[0\.04\]|bg-surface-3|g' \
    -e 's|bg-white/\[0\.05\]|bg-surface-3|g' \
    -e 's|bg-white/\[0\.06\]|bg-surface-3|g' \
    -e 's|bg-white/\[0\.08\]|bg-surface-3|g' \
    -e 's|bg-white/\[0\.1\]|bg-surface-4|g' \
    "$f"

  # ─── Old gold border opacities → stroke-gold ────────────────────
  sed -i \
    -e 's|border-gold-400/8\b|border-stroke-gold|g' \
    -e 's|border-gold-400/10\b|border-stroke-gold|g' \
    -e 's|border-gold-400/12\b|border-stroke-gold|g' \
    -e 's|border-gold-400/15\b|border-stroke-gold|g' \
    -e 's|border-gold-400/20\b|border-stroke-gold|g' \
    -e 's|border-gold-400/25\b|border-stroke-gold|g' \
    -e 's|border-gold-400/30\b|border-stroke-gold-strong|g' \
    -e 's|border-gold-400/40\b|border-stroke-gold-strong|g' \
    "$f"

  # ─── Hermes-green legacy → success ──────────────────────────────
  sed -i \
    -e 's|bg-hermes-green\b|bg-success-400|g' \
    -e 's|text-hermes-green\b|text-success-400|g' \
    -e 's|border-hermes-green\b|border-success-400|g' \
    -e 's|hermes-green/10\b|success-400/10|g' \
    -e 's|hermes-green/20\b|success-400/20|g' \
    -e 's|hermes-green/30\b|success-400/30|g' \
    -e 's|hermes-green/40\b|success-400/40|g' \
    -e 's|hermes-green/50\b|success-400/50|g' \
    "$f"

done

echo ""
echo "✓ Migrated $count files"
