#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# HERMES — Token Migration v2: semantic color unification
# emerald → success | red → danger | blue → info | amber → gold
# ═══════════════════════════════════════════════════════════════════

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"

FILES=$(find "$SRC" \
  \( -name "*.tsx" -o -name "*.ts" \) \
  -not -path "*/ui/*" \
  -not -path "*/shell/*" \
  -not -name "design-tokens.ts" \
  -not -name "cn.ts")

count=0
for f in $FILES; do
  count=$((count + 1))

  # ─── EMERALD → SUCCESS ────────────────────────────────────────
  sed -i \
    -e 's|text-emerald-300\b|text-success-300|g' \
    -e 's|text-emerald-400\b|text-success-400|g' \
    -e 's|text-emerald-500\b|text-success-500|g' \
    -e 's|bg-emerald-300\b|bg-success-300|g' \
    -e 's|bg-emerald-400\b|bg-success-400|g' \
    -e 's|bg-emerald-500\b|bg-success-400|g' \
    -e 's|bg-emerald-500/8|bg-success-400/10|g' \
    -e 's|bg-emerald-500/10|bg-success-400/12|g' \
    -e 's|bg-emerald-500/12|bg-success-400/12|g' \
    -e 's|bg-emerald-500/15|bg-success-400/15|g' \
    -e 's|bg-emerald-500/20|bg-success-400/20|g' \
    -e 's|border-emerald-400/20|border-success-400/30|g' \
    -e 's|border-emerald-400/30|border-success-400/30|g' \
    -e 's|border-emerald-500/20|border-success-400/30|g' \
    -e 's|border-emerald-500/25|border-success-400/30|g' \
    -e 's|border-emerald-500/30|border-success-400/30|g' \
    -e 's|border-emerald-500/40|border-success-400/40|g' \
    -e 's|emerald-500/\[0.04\]|success-400/8|g' \
    "$f"

  # ─── RED → DANGER (preserve text-red-XXX from semantic Tailwind reds) ──
  sed -i \
    -e 's|text-red-300\b|text-danger-300|g' \
    -e 's|text-red-400\b|text-danger-400|g' \
    -e 's|text-red-500\b|text-danger-400|g' \
    -e 's|bg-red-300\b|bg-danger-300|g' \
    -e 's|bg-red-400\b|bg-danger-400|g' \
    -e 's|bg-red-500\b|bg-danger-400|g' \
    -e 's|bg-red-500/8|bg-danger-400/10|g' \
    -e 's|bg-red-500/10|bg-danger-400/12|g' \
    -e 's|bg-red-500/12|bg-danger-400/12|g' \
    -e 's|bg-red-500/15|bg-danger-400/15|g' \
    -e 's|bg-red-500/20|bg-danger-400/20|g' \
    -e 's|border-red-400/20|border-danger-400/30|g' \
    -e 's|border-red-400/30|border-danger-400/30|g' \
    -e 's|border-red-500/20|border-danger-400/30|g' \
    -e 's|border-red-500/25|border-danger-400/30|g' \
    -e 's|border-red-500/30|border-danger-400/30|g' \
    -e 's|border-red-500/40|border-danger-400/40|g' \
    -e 's|red-500/\[0.04\]|danger-400/8|g' \
    "$f"

  # ─── AMBER / ORANGE → GOLD ────────────────────────────────────
  sed -i \
    -e 's|text-amber-300\b|text-gold-300|g' \
    -e 's|text-amber-400\b|text-gold-400|g' \
    -e 's|text-amber-500\b|text-gold-500|g' \
    -e 's|bg-amber-300\b|bg-gold-300|g' \
    -e 's|bg-amber-400\b|bg-gold-400|g' \
    -e 's|bg-amber-500\b|bg-gold-500|g' \
    -e 's|bg-amber-500/10|bg-gold-400/12|g' \
    -e 's|bg-amber-500/15|bg-gold-400/15|g' \
    -e 's|bg-amber-500/20|bg-gold-400/20|g' \
    -e 's|bg-amber-500/30|bg-gold-400/25|g' \
    -e 's|border-amber-400/20|border-stroke-gold|g' \
    -e 's|border-amber-400/30|border-stroke-gold-strong|g' \
    -e 's|border-amber-500/30|border-stroke-gold-strong|g' \
    -e 's|border-amber-500/40|border-stroke-gold-strong|g' \
    -e 's|border-amber-500/50|border-stroke-gold-strong|g' \
    -e 's|border-amber-500/60|border-stroke-gold-strong|g' \
    -e 's|text-orange-400\b|text-warning-400|g' \
    -e 's|text-orange-500\b|text-warning-500|g' \
    -e 's|bg-orange-400\b|bg-warning-400|g' \
    -e 's|bg-orange-500/15\b|bg-warning-400/15|g' \
    -e 's|border-orange-500/30|border-warning-400/30|g' \
    "$f"

  # ─── VIOLET / PURPLE / BLUE → INFO ────────────────────────────
  sed -i \
    -e 's|text-violet-300\b|text-info-400|g' \
    -e 's|text-violet-400\b|text-info-400|g' \
    -e 's|text-violet-500\b|text-info-500|g' \
    -e 's|bg-violet-400\b|bg-info-400|g' \
    -e 's|bg-violet-500\b|bg-info-400|g' \
    -e 's|bg-violet-500/8|bg-info-400/10|g' \
    -e 's|bg-violet-500/10|bg-info-400/12|g' \
    -e 's|bg-violet-500/15|bg-info-400/15|g' \
    -e 's|bg-violet-500/20|bg-info-400/20|g' \
    -e 's|border-violet-400/20|border-info-400/30|g' \
    -e 's|border-violet-500/20|border-info-400/30|g' \
    -e 's|border-violet-500/25|border-info-400/30|g' \
    -e 's|border-violet-500/30|border-info-400/30|g' \
    -e 's|text-blue-300\b|text-info-400|g' \
    -e 's|text-blue-400\b|text-info-400|g' \
    -e 's|bg-blue-400\b|bg-info-400|g' \
    -e 's|bg-blue-500\b|bg-info-400|g' \
    -e 's|bg-blue-500/10\b|bg-info-400/12|g' \
    -e 's|bg-blue-500/15\b|bg-info-400/15|g' \
    -e 's|border-blue-500/20|border-info-400/30|g' \
    -e 's|border-blue-500/30|border-info-400/30|g' \
    "$f"

  # ─── SLATE / GRAY → text scale ────────────────────────────────
  sed -i \
    -e 's|text-slate-400\b|text-text-tertiary|g' \
    -e 's|text-slate-500\b|text-text-tertiary|g' \
    -e 's|text-slate-300\b|text-text-secondary|g' \
    -e 's|text-gray-400\b|text-text-tertiary|g' \
    -e 's|text-gray-500\b|text-text-tertiary|g' \
    "$f"

  # ─── Hex ramps inside style props (#62cbc1 = old success) ─────
  # Skip — these are inline color refs, leave for individual review
done

echo "✓ Migrated $count files (semantic color unification)"
