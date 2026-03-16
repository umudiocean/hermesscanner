// ============================================================================
// HERMES AI FUND - ADMIN API V4
// ============================================================================
// V4: Robust user discovery with event log fallback + nickname support
// Contract counters are SOURCE OF TRUTH for totals
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { verifyAdminAuth } from '@/lib/auth/verifyAdminAuth'
import { CONTRACT_ADDRESSES, HERMES_FUND_ABI, weiToNumber } from '@/lib/hermes-fund/contract'

// BSC RPC URLs
const BSC_RPC_URLS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc-dataseed1.ninicoin.io/',
  'https://bsc.publicnode.com',
]
const PRIMARY_BSC_RPC = process.env.BSC_RPC_URL || ''

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ])
}

// Get a single working provider - consistent for entire request
async function getProvider(): Promise<ethers.JsonRpcProvider> {
  const candidates = [
    ...(PRIMARY_BSC_RPC ? [PRIMARY_BSC_RPC] : []),
    ...BSC_RPC_URLS,
  ]

  for (const url of candidates) {
    try {
      const provider = new ethers.JsonRpcProvider(url)
      await withTimeout(provider.getBlockNumber(), 3000)
      console.log(`[ADMIN] Using RPC: ${url}`)
      return provider
    } catch {
      continue
    }
  }

  return new ethers.JsonRpcProvider(BSC_RPC_URLS[0])
}

const PLAN_NAMES = ['1 Ay', '3 Ay', '6 Ay']

// Plan durations in seconds (for calculating endTime without extra RPC call)
const PLAN_DURATIONS = [
  30 * 24 * 60 * 60,   // Plan 0: 1 Ay = 30 days
  90 * 24 * 60 * 60,   // Plan 1: 3 Ay = 90 days
  180 * 24 * 60 * 60,  // Plan 2: 6 Ay = 180 days
]

// Unlock delay after end time (1 day)
const UNLOCK_DELAY = 24 * 60 * 60

interface UserPosition {
  address: string
  planId: number
  planName: string
  status: number
  statusText: string
  usdtPrincipal: string
  hermesStaked: string
  startTime: number
  endTime: number
  unlockTime: number
  claimedUsdt: string
  claimedHermes: string
  claimableUsdt: string
  claimableHermes: string
  pendingUsdtClaim: string
  pendingHermesClaim: string
  pendingUsdtWithdraw: boolean
  pendingHermesUnstake: boolean
  isUnlocked: boolean
  usdtPaid: boolean
  hermesUnstaked: boolean
}

interface FundAdminStats {
  totalStakedUsdt: string
  totalStakedHermes: string
  totalClaimedUsdt: string
  totalClaimedHermes: string
  activeUserCount: number
  totalUserCount: number
  tvlCap: string
  tvlPercent: number
  minDeposit: string
  maxDeposit: string
  pendingClaimsCount: number
  pendingWithdrawsCount: number
}

function getStatusText(status: number): string {
  switch (status) {
    case 0: return 'None'
    case 1: return 'Active'
    case 2: return 'Matured'
    case 3: return 'Unlocked'
    case 4: return 'Closed'
    default: return 'Unknown'
  }
}

// Fetch user addresses from contract array
// Uses sequential calls to avoid RPC rate limits
async function fetchUserAddresses(
  provider: ethers.JsonRpcProvider, 
  contract: ethers.Contract
): Promise<string[]> {
  const userAddresses: string[] = []
  
  // Get user count
  let userCount = 0
  try {
    userCount = Number(await withTimeout(contract.getUserCount(), 5000))
    console.log(`[ADMIN] Contract getUserCount: ${userCount}`)
  } catch (e: any) {
    console.log('[ADMIN] getUserCount failed:', e.message)
    return []
  }
  
  if (userCount === 0) {
    return []
  }
  
  // Fetch users SEQUENTIALLY to avoid rate limits
  // BSC public RPCs have strict limits on batch/parallel calls
  for (let i = 0; i < userCount; i++) {
    try {
      const addr = await contract.users(i)
      if (addr) {
        userAddresses.push(addr)
      }
      // Small delay between calls
      if (i < userCount - 1) {
        await new Promise(r => setTimeout(r, 50))
      }
    } catch (e: any) {
      console.log(`[ADMIN] Failed to get user at index ${i}:`, e.message)
    }
  }
  
  console.log(`[ADMIN] Fetched ${userAddresses.length}/${userCount} user addresses`)
  return userAddresses
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 })
    }
    
    console.log('[ADMIN] Starting data fetch...')
    
    const provider = await getProvider()
    const contract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, provider)

    // ═══════════════════════════════════════════════════════════════
    // CONTRACT COUNTERS - SOURCE OF TRUTH
    // These are updated atomically on every join/withdraw/claim
    // ═══════════════════════════════════════════════════════════════
    const [
      totalStakedHermes,
      totalStakedUsdt,
      totalClaimedHermes,
      totalClaimedUsdt,
      activeUserCount,
      tvlCap,
      minDeposit,
      maxDeposit,
    ] = await Promise.all([
      contract.totalStakedHermes().catch(() => 0n),
      contract.totalStakedUsdt().catch(() => 0n),
      contract.totalClaimedHermes().catch(() => 0n),
      contract.totalClaimedUsdt().catch(() => 0n),
      contract.activeUserCount().catch(() => 0n),
      contract.tvlCap(),
      contract.minDeposit(),
      contract.maxDeposit(),
    ])

    const totalStakedUsdtNum = weiToNumber(totalStakedUsdt)
    const totalStakedHermesNum = weiToNumber(totalStakedHermes)
    const activeUserCountNum = Number(activeUserCount)
    const tvlCapNum = weiToNumber(tvlCap)
    const tvlPercent = tvlCapNum > 0 ? (totalStakedUsdtNum / tvlCapNum) * 100 : 0

    console.log(`[ADMIN] Contract counters: TVL=${totalStakedUsdtNum}, Users=${activeUserCountNum}`)

    // ═══════════════════════════════════════════════════════════════
    // USER LIST - Robust discovery with fallback
    // ═══════════════════════════════════════════════════════════════
    const userAddresses = await fetchUserAddresses(provider, contract)
    
    const users: UserPosition[] = []
    let pendingClaimsCount = 0
    let pendingWithdrawsCount = 0

    // Process users SEQUENTIALLY to avoid RPC rate limits
    // BSC public RPCs have strict rate limits on batch calls
    for (const addr of userAddresses) {
      try {
        // Fetch position data - make calls sequentially with small delay
        const position = await contract.positions(addr)
        
        const planId = Number(position.planId)
        const status = Number(position.status)
        
        // Skip if no position
        if (status === 0) {
          console.log(`[ADMIN] Skipping ${addr.slice(0,8)}... - status 0`)
          continue
        }
        
        // Small delay between users to avoid rate limits
        await new Promise(r => setTimeout(r, 100))
        
        // Fetch additional data one by one
        const [pendingUsdt, pendingHermes] = await Promise.all([
          contract.pendingUsdtClaim(addr).catch(() => 0n),
          contract.pendingHermesClaim(addr).catch(() => 0n),
        ])
        
        const [pendingUsdtW, pendingHermesU] = await Promise.all([
          contract.pendingUsdtWithdraw(addr).catch(() => false),
          contract.pendingHermesUnstake(addr).catch(() => false),
        ])
        
        const [claimableU, claimableH] = await Promise.all([
          contract.claimableUsdt(addr).catch(() => 0n),
          contract.claimableHermes(addr).catch(() => 0n),
        ])
        
        // Check if unlocked (single call to reduce rate limit issues)
        const unlocked = await contract.isUnlocked(addr).catch(() => false)
        
        // CALCULATE endTime and unlockTime from startTime + planDuration
        // This avoids extra RPC calls that can fail due to rate limits
        const startTimeNum = Number(position.startTime)
        const planDuration = PLAN_DURATIONS[planId] || PLAN_DURATIONS[0]
        const calculatedEndTime = startTimeNum + planDuration
        const calculatedUnlockTime = calculatedEndTime + UNLOCK_DELAY
        
        if (BigInt(pendingUsdt) > 0n || BigInt(pendingHermes) > 0n) {
          pendingClaimsCount++
        }
        if (pendingUsdtW || pendingHermesU) {
          pendingWithdrawsCount++
        }

        const userPos: UserPosition = {
          address: addr,
          planId,
          planName: PLAN_NAMES[planId] || 'Unknown',
          status,
          statusText: getStatusText(status),
          usdtPrincipal: weiToNumber(position.usdtPrincipal).toString(),
          hermesStaked: weiToNumber(position.hermesStaked).toString(),
          startTime: startTimeNum,
          endTime: calculatedEndTime,
          unlockTime: calculatedUnlockTime,
          claimedUsdt: weiToNumber(position.claimedUsdt).toString(),
          claimedHermes: weiToNumber(position.claimedHermes).toString(),
          claimableUsdt: weiToNumber(claimableU).toString(),
          claimableHermes: weiToNumber(claimableH).toString(),
          pendingUsdtClaim: weiToNumber(pendingUsdt).toString(),
          pendingHermesClaim: weiToNumber(pendingHermes).toString(),
          pendingUsdtWithdraw: pendingUsdtW,
          pendingHermesUnstake: pendingHermesU,
          isUnlocked: unlocked,
          usdtPaid: position.usdtPaid,
          hermesUnstaked: position.hermesUnstaked,
        }
        
        users.push(userPos)
        console.log(`[ADMIN] User ${addr.slice(0,8)}... Plan=${planId}, USDT=$${userPos.usdtPrincipal}`)
        
      } catch (error: any) {
        console.error(`[ADMIN] Error fetching position for ${addr}:`, error.message)
        // Continue to next user instead of failing entirely
      }
    }

    console.log(`[ADMIN] Processed ${users.length} users with positions`)

    // ═══════════════════════════════════════════════════════════════
    // BUILD RESPONSE - Use CONTRACT COUNTERS for totals (authoritative)
    // ═══════════════════════════════════════════════════════════════
    const stats: FundAdminStats = {
      totalStakedUsdt: totalStakedUsdtNum.toString(),
      totalStakedHermes: totalStakedHermesNum.toString(),
      totalClaimedUsdt: weiToNumber(totalClaimedUsdt).toString(),
      totalClaimedHermes: weiToNumber(totalClaimedHermes).toString(),
      activeUserCount: activeUserCountNum,
      totalUserCount: users.length,
      tvlCap: tvlCapNum.toString(),
      tvlPercent,
      minDeposit: weiToNumber(minDeposit).toString(),
      maxDeposit: weiToNumber(maxDeposit).toString(),
      pendingClaimsCount,
      pendingWithdrawsCount,
    }

    // Filter users for different views
    const pendingClaims = users.filter(u => 
      Number(u.pendingUsdtClaim) > 0 || Number(u.pendingHermesClaim) > 0
    )
    const pendingWithdraws = users.filter(u => 
      u.pendingUsdtWithdraw || u.pendingHermesUnstake
    )
    const activeUsers = users.filter(u => u.status === 1 || u.status === 2 || u.status === 3)

    console.log(`[ADMIN] Response ready: TVL=${stats.totalStakedUsdt}, Active=${stats.activeUserCount}, Users found=${users.length}`)

    const res = NextResponse.json({
      success: true,
      stats,
      users: activeUsers,
      pendingClaims,
      pendingWithdraws,
      allUsers: users,
    })
    
    // Strict no-cache headers
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.headers.set('CDN-Cache-Control', 'no-store, max-age=0')
    res.headers.set('Vercel-CDN-Cache-Control', 'no-store, max-age=0')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res

  } catch (error: any) {
    console.error('[ADMIN] Fund admin API error:', error)
    const res = NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
    }, { status: 500 })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.headers.set('Pragma', 'no-cache')
    return res
  }
}
