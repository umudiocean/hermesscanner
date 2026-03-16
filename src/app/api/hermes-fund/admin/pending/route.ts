// HERMES AI Fund - Admin Pending Payments API
// Gerçek veriler - Mock yok
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/upstash';
import { 
  FUND_REDIS_KEYS, 
  FUND_CONSTANTS,
  type AdminPendingPayment,
  type AdminDashboardStats,
  type FundStats
} from '@/types/hermesFund';

// Basit auth kontrolü (production'da JWT/session kullanılmalı)
function isAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminToken = process.env.ADMIN_API_TOKEN;
  
  if (!adminToken) return false;
  return authHeader === `Bearer ${adminToken}`;
}

// Varsayılan boş stats
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

export async function GET(request: NextRequest) {
  // Auth kontrolü
  if (!isAuthenticated(request)) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 });
  }

  try {
    let pendingClaims: AdminPendingPayment[] = [];
    let pendingWithdrawals: AdminPendingPayment[] = [];
    let fundStats: FundStats | null = null;
    let todaysClaims = 0;
    let todaysDeposits = 0;
    let treasuryBalance = 0;

    if (redis) {
      // Pending claims
      const claimsList = await redis.lrange(FUND_REDIS_KEYS.PENDING_CLAIMS, 0, -1);
      if (claimsList && claimsList.length > 0) {
        pendingClaims = claimsList as unknown as AdminPendingPayment[];
      }

      // Pending withdrawals
      const withdrawalsList = await redis.lrange(FUND_REDIS_KEYS.PENDING_WITHDRAWALS, 0, -1);
      if (withdrawalsList && withdrawalsList.length > 0) {
        pendingWithdrawals = withdrawalsList as unknown as AdminPendingPayment[];
      }

      // Fund stats
      const stats = await redis.get(FUND_REDIS_KEYS.FUND_STATS);
      if (stats) {
        fundStats = stats as FundStats;
      }

      // Bugünkü istatistikler
      const today = new Date().toISOString().split('T')[0];
      const dailyData = await redis.get(`${FUND_REDIS_KEYS.DAILY_STATS_PREFIX}${today}`);
      if (dailyData) {
        const daily = dailyData as { totalClaimed: number; depositsToday: number };
        todaysClaims = daily.totalClaimed || 0;
        todaysDeposits = daily.depositsToday || 0;
      }
    }

    // Varsayılan boş değerler
    if (!fundStats) {
      fundStats = EMPTY_FUND_STATS;
    }

    const dashboardStats: AdminDashboardStats = {
      fundStats,
      pendingClaims,
      pendingWithdrawals,
      todaysClaims,
      todaysDeposits,
      treasuryBalance
    };

    return NextResponse.json({
      success: true,
      data: dashboardStats,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Admin pending error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch pending payments'
    }, { status: 500 });
  }
}

// POST: Mark payment as completed
export async function POST(request: NextRequest) {
  // Auth kontrolü
  if (!isAuthenticated(request)) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { paymentId, type, txHash, notes } = body;

    if (!paymentId || !type) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    if (redis) {
      const listKey = type === 'claim' 
        ? FUND_REDIS_KEYS.PENDING_CLAIMS 
        : FUND_REDIS_KEYS.PENDING_WITHDRAWALS;

      // Listeden bul ve güncelle
      const list = await redis.lrange(listKey, 0, -1) as unknown as AdminPendingPayment[];
      const index = list.findIndex(p => p.id === paymentId);

      if (index !== -1) {
        const payment = list[index];
        payment.status = 'completed';
        payment.processedAt = Date.now();
        payment.txHash = txHash;
        payment.notes = notes;

        // Güncelle
        await redis.lset(listKey, index, payment);

        return NextResponse.json({
          success: true,
          message: 'Payment marked as completed',
          payment
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Payment not found'
    }, { status: 404 });

  } catch (error) {
    console.error('Admin mark payment error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process request'
    }, { status: 500 });
  }
}
