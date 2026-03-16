// HERMES AI Fund - Queue Claim for Auto-Processing
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/upstash';
import { FUND_REDIS_KEYS, type AdminPendingPayment } from '@/types/hermesFund';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, user, amount } = body;

    if (!type || !user || amount === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: type, user, amount'
      }, { status: 400 });
    }

    if (!redis) {
      return NextResponse.json({
        success: false,
        error: 'Redis not available'
      }, { status: 500 });
    }

    // Create pending payment record
    const payment: AdminPendingPayment = {
      id: `${type}_${user}_${Date.now()}`,
      type: type as AdminPendingPayment['type'],
      user: user.toLowerCase(),
      amount: Number(amount),
      requestedAt: Date.now(),
      status: 'pending'
    };

    // Determine which Redis list to use
    let redisKey: string;
    if (type === 'usdt_claim' || type === 'hermes_claim') {
      redisKey = FUND_REDIS_KEYS.PENDING_CLAIMS;
    } else if (type === 'usdt_withdraw') {
      redisKey = FUND_REDIS_KEYS.PENDING_WITHDRAWALS;
    } else if (type === 'hermes_unstake') {
      redisKey = FUND_REDIS_KEYS.PENDING_UNSTAKES;
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid type'
      }, { status: 400 });
    }

    // Check if already pending for this user
    const existingList = await redis.lrange(redisKey, 0, -1) as unknown as AdminPendingPayment[];
    const alreadyPending = existingList.some(
      p => p.user.toLowerCase() === user.toLowerCase() && 
           p.type === type && 
           p.status === 'pending'
    );

    if (alreadyPending) {
      return NextResponse.json({
        success: true,
        message: 'Already queued',
        payment: null
      });
    }

    // Add to Redis list
    await redis.rpush(redisKey, JSON.stringify(payment));

    console.log(`[QUEUE-CLAIM] Added: ${type} for ${user}, amount: ${amount}`);

    return NextResponse.json({
      success: true,
      message: 'Queued for auto-processing',
      payment
    });

  } catch (error: any) {
    console.error('[QUEUE-CLAIM] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to queue claim'
    }, { status: 500 });
  }
}

