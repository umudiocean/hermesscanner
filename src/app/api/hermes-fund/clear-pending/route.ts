// HERMES AI Fund - Clear Pending Claims/Withdrawals
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/upstash';
import { FUND_REDIS_KEYS, type AdminPendingPayment } from '@/types/hermesFund';

// DELETE: Clear ALL pending claims (no auth - emergency use)
export async function DELETE() {
  try {
    if (!redis) {
      throw new Error('Redis not available');
    }
    
    await redis.del(FUND_REDIS_KEYS.PENDING_CLAIMS);
    await redis.del(FUND_REDIS_KEYS.PENDING_WITHDRAWALS);
    await redis.del(FUND_REDIS_KEYS.PENDING_UNSTAKES);
    
    return NextResponse.json({
      success: true,
      message: 'All pending claims cleared'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Admin auth check
  const authHeader = request.headers.get('authorization');
  const adminToken = process.env.ADMIN_API_TOKEN;
  
  if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { userAddress, type, clearAll } = body;
    
    if (!redis) {
      throw new Error('Redis not available');
    }
    
    let clearedCount = 0;
    
    if (clearAll) {
      // Clear all pending
      await redis.del(FUND_REDIS_KEYS.PENDING_CLAIMS);
      await redis.del(FUND_REDIS_KEYS.PENDING_WITHDRAWALS);
      await redis.del(FUND_REDIS_KEYS.PENDING_UNSTAKES);
      clearedCount = -1; // All cleared
    } else if (userAddress) {
      // Clear specific user's pending items
      const keys = [
        FUND_REDIS_KEYS.PENDING_CLAIMS,
        FUND_REDIS_KEYS.PENDING_WITHDRAWALS,
        FUND_REDIS_KEYS.PENDING_UNSTAKES
      ];
      
      for (const key of keys) {
        const list = await redis.lrange(key, 0, -1) as unknown as AdminPendingPayment[];
        const filtered = list.filter(item => 
          item.user.toLowerCase() !== userAddress.toLowerCase() ||
          (type && item.type !== type)
        );
        
        if (filtered.length !== list.length) {
          clearedCount += list.length - filtered.length;
          await redis.del(key);
          if (filtered.length > 0) {
            await redis.rpush(key, ...filtered.map(f => JSON.stringify(f)));
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: clearAll ? 'All pending items cleared' : `Cleared ${clearedCount} items`,
      clearedCount
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// GET: List all pending for a user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get('address');
  
  try {
    if (!redis) {
      throw new Error('Redis not available');
    }
    
    const claims = await redis.lrange(FUND_REDIS_KEYS.PENDING_CLAIMS, 0, -1) as unknown as AdminPendingPayment[];
    const withdrawals = await redis.lrange(FUND_REDIS_KEYS.PENDING_WITHDRAWALS, 0, -1) as unknown as AdminPendingPayment[];
    const unstakes = await redis.lrange(FUND_REDIS_KEYS.PENDING_UNSTAKES, 0, -1) as unknown as AdminPendingPayment[];
    
    let filtered = { claims, withdrawals, unstakes };
    
    if (userAddress) {
      filtered = {
        claims: claims.filter(c => c.user.toLowerCase() === userAddress.toLowerCase()),
        withdrawals: withdrawals.filter(w => w.user.toLowerCase() === userAddress.toLowerCase()),
        unstakes: unstakes.filter(u => u.user.toLowerCase() === userAddress.toLowerCase()),
      };
    }
    
    return NextResponse.json({
      success: true,
      pending: filtered,
      totalPending: filtered.claims.length + filtered.withdrawals.length + filtered.unstakes.length
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// PUT: Retry failed claims (reset status to pending)
export async function PUT(request: NextRequest) {
  // Auth check with AUTO_PROCESS_SECRET or CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');
  const autoProcessSecret = process.env.AUTO_PROCESS_SECRET;
  const adminToken = process.env.ADMIN_API_TOKEN;
  
  const isAuthorized = 
    (autoProcessSecret && authHeader === `Bearer ${autoProcessSecret}`) ||
    (autoProcessSecret && cronSecret === autoProcessSecret) ||
    (adminToken && authHeader === `Bearer ${adminToken}`) ||
    (process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET);
  
  if (!isAuthorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const { retryAll, userAddress } = body;
    
    if (!redis) {
      throw new Error('Redis not available');
    }
    
    let retriedCount = 0;
    
    const keys = [
      FUND_REDIS_KEYS.PENDING_CLAIMS,
      FUND_REDIS_KEYS.PENDING_WITHDRAWALS,
      FUND_REDIS_KEYS.PENDING_UNSTAKES
    ];
    
    for (const key of keys) {
      const list = await redis.lrange(key, 0, -1) as unknown as AdminPendingPayment[];
      let updated = false;
      
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const shouldRetry = item.status === 'failed' && 
          (retryAll || !userAddress || item.user.toLowerCase() === userAddress.toLowerCase());
        
        if (shouldRetry) {
          item.status = 'pending';
          item.notes = `Retry at ${new Date().toISOString()}`;
          await redis.lset(key, i, JSON.stringify(item));
          retriedCount++;
          updated = true;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Reset ${retriedCount} failed items to pending`,
      retriedCount
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

