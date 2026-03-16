// HERMES AI Fund - Auto-Process Claims & Unstakes
// Admin onayı olmadan otomatik ödeme sistemi
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/upstash';
import { ethers } from 'ethers';
import { 
  FUND_REDIS_KEYS, 
  type AdminPendingPayment 
} from '@/types/hermesFund';
import { 
  CONTRACT_ADDRESSES, 
  HERMES_FUND_ABI,
  USDT_ABI,
  HERMES_ABI 
} from '@/lib/hermes-fund/contract';

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;
const AUTO_PROCESS_SECRET = process.env.AUTO_PROCESS_SECRET;

// Unstake için ek bekleme süresi (stake süresi + 1 gün)
const UNSTAKE_EXTRA_DAYS = 1;

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getProvider() {
  return new ethers.JsonRpcProvider(BSC_RPC);
}

function getTreasuryWallet() {
  if (!TREASURY_PRIVATE_KEY) {
    throw new Error('TREASURY_PRIVATE_KEY not configured');
  }
  const provider = getProvider();
  return new ethers.Wallet(TREASURY_PRIVATE_KEY, provider);
}

async function transferUsdt(to: string, amount: bigint): Promise<string> {
  const wallet = getTreasuryWallet();
  const usdtContract = new ethers.Contract(CONTRACT_ADDRESSES.USDT, USDT_ABI, wallet);
  
  const tx = await usdtContract.transfer(to, amount);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function transferHermes(to: string, amount: bigint): Promise<string> {
  const wallet = getTreasuryWallet();
  const hermesContract = new ethers.Contract(CONTRACT_ADDRESSES.HERMES, HERMES_ABI, wallet);
  
  const tx = await hermesContract.transfer(to, amount);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function markUsdtClaimPaid(userAddress: string): Promise<string> {
  const wallet = getTreasuryWallet();
  const fundContract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, wallet);
  
  const tx = await fundContract.markUsdtClaimPaid(userAddress);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function markHermesClaimPaid(userAddress: string): Promise<string> {
  const wallet = getTreasuryWallet();
  const fundContract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, wallet);
  
  const tx = await fundContract.markHermesClaimPaid(userAddress);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function markUsdtWithdrawPaid(userAddress: string): Promise<string> {
  const wallet = getTreasuryWallet();
  const fundContract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, wallet);
  
  const tx = await fundContract.markUsdtWithdrawPaid(userAddress);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function markHermesUnstakePaid(userAddress: string): Promise<string> {
  const wallet = getTreasuryWallet();
  const fundContract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, wallet);
  
  const tx = await fundContract.markHermesUnstakePaid(userAddress);
  const receipt = await tx.wait();
  return receipt.hash;
}

// Check if unstake period has passed (stake duration + 1 extra day)
async function canUnstake(userAddress: string): Promise<boolean> {
  const provider = getProvider();
  const fundContract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, provider);
  
  try {
    const position = await fundContract.positions(userAddress);
    const startTime = Number(position.startTime);
    const planId = Number(position.planId);
    
    // Plan süreleri (gün cinsinden) - DOĞRU DEĞERLER
    const planDurations: Record<number, number> = {
      0: 30,   // Plan A: 30 gün (1 Ay)
      1: 90,   // Plan B: 90 gün (3 Ay)
      2: 180,  // Plan C: 180 gün (6 Ay)
    };
    
    const stakeDays = planDurations[planId] || 90;
    const unlockTime = startTime + (stakeDays * 24 * 60 * 60);
    const extraTime = UNSTAKE_EXTRA_DAYS * 24 * 60 * 60;
    const canUnstakeTime = unlockTime + extraTime;
    
    const now = Math.floor(Date.now() / 1000);
    return now >= canUnstakeTime;
  } catch (error) {
    console.error('canUnstake check failed:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// PROCESS FUNCTIONS
// ═══════════════════════════════════════════════════════════════

interface ProcessResult {
  id: string;
  type: string;
  user: string;
  status: 'success' | 'failed' | 'skipped';
  txHash?: string;
  error?: string;
}

async function processClaim(payment: AdminPendingPayment): Promise<ProcessResult> {
  const result: ProcessResult = {
    id: payment.id,
    type: payment.type,
    user: payment.user,
    status: 'failed'
  };
  
  try {
    // USDT decimals: 18, HERMES decimals: 18
    const amountWei = ethers.parseUnits(payment.amount.toString(), 18);
    
    if (payment.type === 'usdt_claim') {
      // 1. Transfer USDT from Treasury to User
      const transferTx = await transferUsdt(payment.user, amountWei);
      console.log(`[AUTO] USDT transferred to ${payment.user}: ${transferTx}`);
      
      // 2. Mark as paid in smart contract
      const markTx = await markUsdtClaimPaid(payment.user);
      console.log(`[AUTO] USDT claim marked paid: ${markTx}`);
      
      result.status = 'success';
      result.txHash = markTx;
      
    } else if (payment.type === 'hermes_claim') {
      // 1. Transfer HERMES from Treasury to User
      const transferTx = await transferHermes(payment.user, amountWei);
      console.log(`[AUTO] HERMES transferred to ${payment.user}: ${transferTx}`);
      
      // 2. Mark as paid in smart contract
      const markTx = await markHermesClaimPaid(payment.user);
      console.log(`[AUTO] HERMES claim marked paid: ${markTx}`);
      
      result.status = 'success';
      result.txHash = markTx;
    }
    
  } catch (error: any) {
    console.error(`[AUTO] Claim process failed for ${payment.user}:`, error);
    result.error = error.message || 'Unknown error';
  }
  
  return result;
}

async function processWithdraw(payment: AdminPendingPayment): Promise<ProcessResult> {
  const result: ProcessResult = {
    id: payment.id,
    type: payment.type,
    user: payment.user,
    status: 'failed'
  };
  
  try {
    // Check if unstake period has passed
    if (payment.type === 'hermes_unstake') {
      const canProcess = await canUnstake(payment.user);
      if (!canProcess) {
        result.status = 'skipped';
        result.error = 'Unstake period not yet passed (+1 day required)';
        return result;
      }
    }
    
    const amountWei = ethers.parseUnits(payment.amount.toString(), 18);
    
    if (payment.type === 'usdt_withdraw') {
      // 1. Transfer USDT from Treasury to User
      const transferTx = await transferUsdt(payment.user, amountWei);
      console.log(`[AUTO] USDT withdrawn to ${payment.user}: ${transferTx}`);
      
      // 2. Mark as paid in smart contract
      const markTx = await markUsdtWithdrawPaid(payment.user);
      console.log(`[AUTO] USDT withdraw marked paid: ${markTx}`);
      
      result.status = 'success';
      result.txHash = markTx;
      
    } else if (payment.type === 'hermes_unstake') {
      // 1. Transfer HERMES from Treasury to User
      const transferTx = await transferHermes(payment.user, amountWei);
      console.log(`[AUTO] HERMES unstaked to ${payment.user}: ${transferTx}`);
      
      // 2. Mark as paid in smart contract
      const markTx = await markHermesUnstakePaid(payment.user);
      console.log(`[AUTO] HERMES unstake marked paid: ${markTx}`);
      
      result.status = 'success';
      result.txHash = markTx;
    }
    
  } catch (error: any) {
    console.error(`[AUTO] Withdraw process failed for ${payment.user}:`, error);
    result.error = error.message || 'Unknown error';
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════
// MAIN API HANDLER
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // Security: Verify secret token
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');
  
  const isAuthorized = 
    (AUTO_PROCESS_SECRET && authHeader === `Bearer ${AUTO_PROCESS_SECRET}`) ||
    (AUTO_PROCESS_SECRET && cronSecret === AUTO_PROCESS_SECRET) ||
    (process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET);
  
  if (!isAuthorized) {
    return NextResponse.json({ 
      success: false, 
      error: 'Unauthorized' 
    }, { status: 401 });
  }
  
  // Check required env vars
  if (!TREASURY_PRIVATE_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'Treasury wallet not configured' 
    }, { status: 500 });
  }
  
  const results: ProcessResult[] = [];
  
  try {
    if (!redis) {
      throw new Error('Redis not available');
    }
    
    // ═══════════════════════════════════════════════════════════
    // PROCESS PENDING CLAIMS (USDT + HERMES)
    // ═══════════════════════════════════════════════════════════
    
    const pendingClaims = await redis.lrange(FUND_REDIS_KEYS.PENDING_CLAIMS, 0, -1) as unknown as AdminPendingPayment[];
    
    for (const claim of pendingClaims) {
      if (claim.status !== 'pending') continue;
      
      // Mark as processing
      const claimIndex = pendingClaims.findIndex(c => c.id === claim.id);
      if (claimIndex !== -1) {
        claim.status = 'processing';
        await redis.lset(FUND_REDIS_KEYS.PENDING_CLAIMS, claimIndex, claim);
      }
      
      // Process
      const result = await processClaim(claim);
      results.push(result);
      
      // Update Redis
      if (result.status === 'success') {
        claim.status = 'completed';
        claim.processedAt = Date.now();
        claim.txHash = result.txHash;
        claim.notes = 'Auto-processed';
      } else {
        claim.status = 'failed';
        claim.notes = result.error || 'Processing failed';
      }
      
      await redis.lset(FUND_REDIS_KEYS.PENDING_CLAIMS, claimIndex, claim);
    }
    
    // ═══════════════════════════════════════════════════════════
    // PROCESS PENDING WITHDRAWALS (USDT + HERMES Unstake)
    // ═══════════════════════════════════════════════════════════
    
    const pendingWithdrawals = await redis.lrange(FUND_REDIS_KEYS.PENDING_WITHDRAWALS, 0, -1) as unknown as AdminPendingPayment[];
    
    for (const withdrawal of pendingWithdrawals) {
      if (withdrawal.status !== 'pending') continue;
      
      // Mark as processing
      const withdrawIndex = pendingWithdrawals.findIndex(w => w.id === withdrawal.id);
      if (withdrawIndex !== -1) {
        withdrawal.status = 'processing';
        await redis.lset(FUND_REDIS_KEYS.PENDING_WITHDRAWALS, withdrawIndex, withdrawal);
      }
      
      // Process
      const result = await processWithdraw(withdrawal);
      results.push(result);
      
      // Update Redis
      if (result.status === 'success') {
        withdrawal.status = 'completed';
        withdrawal.processedAt = Date.now();
        withdrawal.txHash = result.txHash;
        withdrawal.notes = 'Auto-processed';
      } else if (result.status === 'skipped') {
        withdrawal.status = 'pending'; // Keep pending
        withdrawal.notes = result.error;
      } else {
        withdrawal.status = 'failed';
        withdrawal.notes = result.error || 'Processing failed';
      }
      
      await redis.lset(FUND_REDIS_KEYS.PENDING_WITHDRAWALS, withdrawIndex, withdrawal);
    }
    
    // ═══════════════════════════════════════════════════════════
    // PROCESS PENDING UNSTAKES
    // ═══════════════════════════════════════════════════════════
    
    const pendingUnstakes = await redis.lrange(FUND_REDIS_KEYS.PENDING_UNSTAKES, 0, -1) as unknown as AdminPendingPayment[];
    
    for (const unstake of pendingUnstakes) {
      if (unstake.status !== 'pending') continue;
      
      // Check if can unstake (stake period + 1 day)
      const canProcess = await canUnstake(unstake.user);
      if (!canProcess) {
        results.push({
          id: unstake.id,
          type: unstake.type,
          user: unstake.user,
          status: 'skipped',
          error: 'Unstake period not yet passed (+1 day required)'
        });
        continue;
      }
      
      // Mark as processing
      const unstakeIndex = pendingUnstakes.findIndex(u => u.id === unstake.id);
      if (unstakeIndex !== -1) {
        unstake.status = 'processing';
        await redis.lset(FUND_REDIS_KEYS.PENDING_UNSTAKES, unstakeIndex, unstake);
      }
      
      // Process
      const result = await processWithdraw(unstake);
      results.push(result);
      
      // Update Redis
      if (result.status === 'success') {
        unstake.status = 'completed';
        unstake.processedAt = Date.now();
        unstake.txHash = result.txHash;
        unstake.notes = 'Auto-processed';
      } else {
        unstake.status = 'failed';
        unstake.notes = result.error || 'Processing failed';
      }
      
      await redis.lset(FUND_REDIS_KEYS.PENDING_UNSTAKES, unstakeIndex, unstake);
    }
    
    // Summary
    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    };
    
    console.log(`[AUTO-PROCESS] Completed: ${JSON.stringify(summary)}`);
    
    return NextResponse.json({
      success: true,
      summary,
      results,
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('[AUTO-PROCESS] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Auto-process failed',
      results
    }, { status: 500 });
  }
}

// GET: Cron trigger OR status check
// Vercel cron jobs use GET requests with CRON_SECRET header
export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-vercel-cron-secret') || request.headers.get('authorization');
  const isCronTrigger = 
    (process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) ||
    (AUTO_PROCESS_SECRET && cronSecret === `Bearer ${AUTO_PROCESS_SECRET}`);
  
  // If cron trigger, process pending payments
  if (isCronTrigger) {
    console.log('[AUTO-PROCESS] Cron triggered');
    
    if (!TREASURY_PRIVATE_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'Treasury wallet not configured' 
      }, { status: 500 });
    }
    
    const results: ProcessResult[] = [];
    
    try {
      if (!redis) {
        throw new Error('Redis not available');
      }
      
      // Process Claims
      const pendingClaims = await redis.lrange(FUND_REDIS_KEYS.PENDING_CLAIMS, 0, -1) as unknown as AdminPendingPayment[];
      
      for (let i = 0; i < pendingClaims.length; i++) {
        const claim = pendingClaims[i];
        if (claim.status !== 'pending') continue;
        
        claim.status = 'processing';
        await redis.lset(FUND_REDIS_KEYS.PENDING_CLAIMS, i, claim);
        
        const result = await processClaim(claim);
        results.push(result);
        
        if (result.status === 'success') {
          claim.status = 'completed';
          claim.processedAt = Date.now();
          claim.txHash = result.txHash;
          claim.notes = 'Auto-processed by cron';
        } else {
          claim.status = 'failed';
          claim.notes = result.error || 'Processing failed';
        }
        
        await redis.lset(FUND_REDIS_KEYS.PENDING_CLAIMS, i, claim);
      }
      
      // Process Withdrawals
      const pendingWithdrawals = await redis.lrange(FUND_REDIS_KEYS.PENDING_WITHDRAWALS, 0, -1) as unknown as AdminPendingPayment[];
      
      for (let i = 0; i < pendingWithdrawals.length; i++) {
        const withdrawal = pendingWithdrawals[i];
        if (withdrawal.status !== 'pending') continue;
        
        withdrawal.status = 'processing';
        await redis.lset(FUND_REDIS_KEYS.PENDING_WITHDRAWALS, i, withdrawal);
        
        const result = await processWithdraw(withdrawal);
        results.push(result);
        
        if (result.status === 'success') {
          withdrawal.status = 'completed';
          withdrawal.processedAt = Date.now();
          withdrawal.txHash = result.txHash;
          withdrawal.notes = 'Auto-processed by cron';
        } else if (result.status === 'skipped') {
          withdrawal.status = 'pending';
          withdrawal.notes = result.error;
        } else {
          withdrawal.status = 'failed';
          withdrawal.notes = result.error || 'Processing failed';
        }
        
        await redis.lset(FUND_REDIS_KEYS.PENDING_WITHDRAWALS, i, withdrawal);
      }
      
      // Process Unstakes
      const pendingUnstakes = await redis.lrange(FUND_REDIS_KEYS.PENDING_UNSTAKES, 0, -1) as unknown as AdminPendingPayment[];
      
      for (let i = 0; i < pendingUnstakes.length; i++) {
        const unstake = pendingUnstakes[i];
        if (unstake.status !== 'pending') continue;
        
        const canProcess = await canUnstake(unstake.user);
        if (!canProcess) {
          results.push({
            id: unstake.id,
            type: unstake.type,
            user: unstake.user,
            status: 'skipped',
            error: 'Unstake period not passed (+1 day)'
          });
          continue;
        }
        
        unstake.status = 'processing';
        await redis.lset(FUND_REDIS_KEYS.PENDING_UNSTAKES, i, unstake);
        
        const result = await processWithdraw(unstake);
        results.push(result);
        
        if (result.status === 'success') {
          unstake.status = 'completed';
          unstake.processedAt = Date.now();
          unstake.txHash = result.txHash;
          unstake.notes = 'Auto-processed by cron';
        } else {
          unstake.status = 'failed';
          unstake.notes = result.error || 'Processing failed';
        }
        
        await redis.lset(FUND_REDIS_KEYS.PENDING_UNSTAKES, i, unstake);
      }
      
      const summary = {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
      };
      
      console.log(`[AUTO-PROCESS] Cron completed: ${JSON.stringify(summary)}`);
      
      return NextResponse.json({
        success: true,
        summary,
        results,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      console.error('[AUTO-PROCESS] Cron error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        results
      }, { status: 500 });
    }
  }
  
  // Otherwise, return status
  try {
    if (!redis) {
      return NextResponse.json({ success: false, error: 'Redis not available' }, { status: 500 });
    }
    
    const pendingClaims = await redis.lrange(FUND_REDIS_KEYS.PENDING_CLAIMS, 0, -1) as unknown as AdminPendingPayment[];
    const pendingWithdrawals = await redis.lrange(FUND_REDIS_KEYS.PENDING_WITHDRAWALS, 0, -1) as unknown as AdminPendingPayment[];
    const pendingUnstakes = await redis.lrange(FUND_REDIS_KEYS.PENDING_UNSTAKES, 0, -1) as unknown as AdminPendingPayment[];
    
    const pending = {
      claims: pendingClaims.filter(c => c.status === 'pending'),
      withdrawals: pendingWithdrawals.filter(w => w.status === 'pending'),
      unstakes: pendingUnstakes.filter(u => u.status === 'pending'),
    };
    
    return NextResponse.json({
      success: true,
      pending: {
        claimsCount: pending.claims.length,
        withdrawalsCount: pending.withdrawals.length,
        unstakesCount: pending.unstakes.length,
        total: pending.claims.length + pending.withdrawals.length + pending.unstakes.length
      },
      configured: {
        treasury: !!TREASURY_PRIVATE_KEY,
        autoProcessSecret: !!AUTO_PROCESS_SECRET,
        bscRpc: !!BSC_RPC
      },
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

