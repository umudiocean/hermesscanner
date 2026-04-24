'use client'

import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// ═══════════════════════════════════════════════════════════════════
// Skeleton — shimmer placeholder primitive
// ═══════════════════════════════════════════════════════════════════

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
} as const

export function Skeleton({
  width,
  height,
  rounded = 'md',
  className,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2 bg-[length:200%_100%] animate-shimmer-bg',
        roundedMap[rounded],
        className,
      )}
      style={{ width, height, ...style }}
      {...rest}
    />
  )
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? '60%' : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  )
}

export function SkeletonRow({
  columns = 6,
  className,
}: {
  columns?: number
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 py-2.5', className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} height={14} className="flex-1" rounded="sm" />
      ))}
    </div>
  )
}
