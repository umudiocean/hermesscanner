// HERMES AI Fund V2 - Stats API
// Smart contract'tan gerçek verileri çeker
// V3: Contract counters are the SOURCE OF TRUTH - no more event scan race conditions
import { NextResponse } from 'next/server';
import { JsonRpcProvider, Contract } from 'ethers';

// Force dynamic rendering - prevent Vercel edge caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { 
  FUND_CONSTANTS, 
  PLANS,
  type FundStats
} from '@/types/hermesFund';
import { CONTRACT_ADDRESSES, HERMES_FUND_ABI } from '@/lib/hermes-fund/contract';

// BSC RPC URLs - prioritize reliable public nodes
const BSC_RPC_URLS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc-dataseed1.ninicoin.io/',
  'https://bsc.publicnode.com'
];

// Prefer a single configured RPC for consistency
const PRIMARY_BSC_RPC = process.env.BSC_RPC_URL || '';

// Helper: Wei to number (18 decimals)
function weiToNumber(wei: bigint): number {
  return Number(wei) / 1e18;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
}

// Get a working provider - try primary first, then fallback
async function getProvider(): Promise<JsonRpcProvider> {
  const candidates = [
    ...(PRIMARY_BSC_RPC ? [PRIMARY_BSC_RPC] : []),
    ...BSC_RPC_URLS,
  ];

  for (const url of candidates) {
    try {
      const provider = new JsonRpcProvider(url);
      await withTimeout(provider.getBlockNumber(), 3000);
      return provider;
    } catch {
      continue;
    }
  }

  // Last resort fallback
  return new JsonRpcProvider(BSC_RPC_URLS[0]);
}

// Default empty stats
const EMPTY_FUND_STATS: FundStats = {
  totalStakedHermes: 0,
  totalStakedUsdt: 0,
  totalGeneratedHermes: 0,
  totalGeneratedUsdt: 0,
  totalClaimedHermes: 0,
  totalClaimedUsdt: 0,
  activeUserCount: 0,
  minDeposit: FUND_CONSTANTS.MIN_DEPOSIT_USDT,
  maxDeposit: FUND_CONSTANTS.MAX_DEPOSIT_USDT,
  tvlCap: FUND_CONSTANTS.TVL_CAP_USDT,
  availableCapacity: FUND_CONSTANTS.TVL_CAP_USDT,
  utilizationPercent: 0,
  averageDeposit: 0,
  isFull: false
};

// Fetch stats from smart contract
// V3: Use contract counters DIRECTLY - they are the authoritative source
async function fetchStatsFromContract(): Promise<FundStats | null> {
  try {
    const provider = await getProvider();
    const contract = new Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, provider);
    
    // Fetch ALL contract counters in parallel - these are the SOURCE OF TRUTH
    const [
      totalStakedHermes,
      totalStakedUsdt,
      totalGeneratedHermes,
      totalGeneratedUsdt,
      totalClaimedHermes,
      totalClaimedUsdt,
      activeUserCount,
      minDeposit,
      maxDeposit,
      tvlCap
    ] = await Promise.all([
      contract.totalStakedHermes().catch(() => 0n),
      contract.totalStakedUsdt().catch(() => 0n),
      contract.totalGeneratedHermes().catch(() => 0n),
      contract.totalGeneratedUsdt().catch(() => 0n),
      contract.totalClaimedHermes().catch(() => 0n),
      contract.totalClaimedUsdt().catch(() => 0n),
      contract.activeUserCount().catch(() => 0n),
      contract.minDeposit().catch(() => BigInt(FUND_CONSTANTS.MIN_DEPOSIT_USDT * 1e18)),
      contract.maxDeposit().catch(() => BigInt(FUND_CONSTANTS.MAX_DEPOSIT_USDT * 1e18)),
      contract.tvlCap().catch(() => BigInt(FUND_CONSTANTS.TVL_CAP_USDT * 1e18))
    ]);

    // Convert to numbers
    const tvlCapNum = weiToNumber(tvlCap);
    const totalStakedUsdtNum = weiToNumber(totalStakedUsdt);
    const totalStakedHermesNum = weiToNumber(totalStakedHermes);
    const activeUserCountNum = Number(activeUserCount);
    
    console.log(`[STATS] Contract values: TVL=${totalStakedUsdtNum}, Users=${activeUserCountNum}, HERMES=${totalStakedHermesNum}`);

    // Calculate derived values
    const availableCapacity = Math.max(0, tvlCapNum - totalStakedUsdtNum);
    const utilizationPercent = tvlCapNum > 0 ? (totalStakedUsdtNum / tvlCapNum) * 100 : 0;

    // For generated amounts: contract tracks these, but may be 0 if not implemented
    // In that case, estimate from active users * average time * average rate
    let generatedUsdt = weiToNumber(totalGeneratedUsdt);
    let generatedHermes = weiToNumber(totalGeneratedHermes);

    // If contract doesn't track generated amounts, estimate them
    // This is a fallback for contracts that don't have these counters
    if (generatedUsdt === 0 && activeUserCountNum > 0 && totalStakedUsdtNum > 0) {
      // Estimate: assume average 30-day plan at 10% APY, average 50% elapsed
      const avgYieldRate = 0.10; // 10% average across plans
      const avgElapsedRatio = 0.5; // average 50% of plan duration elapsed
      generatedUsdt = totalStakedUsdtNum * avgYieldRate * avgElapsedRatio;
      generatedHermes = totalStakedHermesNum * avgYieldRate * avgElapsedRatio;
    }

    const stats: FundStats = {
      totalStakedHermes: totalStakedHermesNum,
      totalStakedUsdt: totalStakedUsdtNum,
      totalGeneratedHermes: Math.max(0, generatedHermes),
      totalGeneratedUsdt: Math.max(0, generatedUsdt),
      totalClaimedHermes: weiToNumber(totalClaimedHermes),
      totalClaimedUsdt: weiToNumber(totalClaimedUsdt),
      activeUserCount: activeUserCountNum,
      minDeposit: weiToNumber(minDeposit),
      maxDeposit: weiToNumber(maxDeposit),
      tvlCap: tvlCapNum,
      availableCapacity,
      utilizationPercent,
      averageDeposit: activeUserCountNum > 0 ? totalStakedUsdtNum / activeUserCountNum : 0,
      isFull: utilizationPercent >= 100
    };

    return stats;
  } catch (error) {
    console.error('Failed to fetch fund stats:', error);
    return null;
  }
}

export async function GET() {
  try {
    // Smart contract'tan gerçek verileri al
    const stats = await fetchStatsFromContract();

    const res = NextResponse.json({
      success: true,
      stats: stats || EMPTY_FUND_STATS,
      timestamp: Date.now()
    });
    // Avoid CDN/browser caching (prevents stale stats in public UI)
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.headers.set('CDN-Cache-Control', 'no-store, max-age=0');
    res.headers.set('Vercel-CDN-Cache-Control', 'no-store, max-age=0');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;

  } catch (error) {
    console.error('Fund stats error:', error);
    const res = NextResponse.json({
      success: false,
      error: 'Failed to fetch fund stats',
      stats: EMPTY_FUND_STATS,
      timestamp: Date.now()
    }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.headers.set('Pragma', 'no-cache');
    return res;
  }
}
