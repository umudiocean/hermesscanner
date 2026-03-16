// HERMES AI Fund - Auto-Process V2
// Directly reads pending claims from smart contract (not Redis)
// More reliable - blockchain is the source of truth

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { 
  CONTRACT_ADDRESSES, 
  HERMES_FUND_ABI,
  USDT_ABI,
  HERMES_ABI,
  weiToNumber
} from '@/lib/hermes-fund/contract';

const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;

// Yield reduction factor — send reduced claim amounts
// Withdraw (principal) and unstake are NOT reduced
const YIELD_REDUCTION = 0.5;

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

interface ProcessResult {
  user: string;
  type: string;
  amount: number;
  status: 'success' | 'failed' | 'skipped';
  txHash?: string;
  error?: string;
}

// GET: Cron trigger - Process ALL pending claims directly from contract
export async function GET(request: NextRequest) {
  // Auth check - multiple methods supported:
  // 1. Vercel Cron: Authorization: Bearer <CRON_SECRET>
  // 2. Manual: ?run=true (for testing)
  // 3. Header: x-cron-secret
  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const runParam = request.nextUrl.searchParams.get('run');
  
  const isAuthorized = 
    // Vercel cron sends Authorization: Bearer <CRON_SECRET>
    (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
    // Alternative header
    (process.env.CRON_SECRET && xCronSecret === process.env.CRON_SECRET) ||
    // AUTO_PROCESS_SECRET as backup
    (process.env.AUTO_PROCESS_SECRET && authHeader === `Bearer ${process.env.AUTO_PROCESS_SECRET}`) ||
    // Manual trigger for testing
    runParam === 'true';
  
  console.log('[AUTO-PROCESS-V2] Auth check:', { 
    hasAuthHeader: !!authHeader, 
    hasCronSecret: !!process.env.CRON_SECRET,
    hasRunParam: runParam === 'true',
    isAuthorized 
  });
  
  // If not cron trigger, return status
  if (!isAuthorized) {
    return NextResponse.json({
      success: true,
      message: 'Auto-process V2 endpoint ready. Use ?run=true to trigger manually.',
      configured: {
        treasury: !!TREASURY_PRIVATE_KEY,
        bscRpc: !!BSC_RPC,
        cronSecret: !!process.env.CRON_SECRET
      }
    });
  }
  
  console.log('[AUTO-PROCESS-V2] Starting...');
  
  if (!TREASURY_PRIVATE_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'TREASURY_PRIVATE_KEY not configured' 
    }, { status: 500 });
  }
  
  const results: ProcessResult[] = [];
  
  try {
    const provider = getProvider();
    const wallet = getTreasuryWallet();
    const fundContract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, provider);
    const fundContractWrite = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, wallet);
    const usdtContract = new ethers.Contract(CONTRACT_ADDRESSES.USDT, USDT_ABI, wallet);
    const hermesContract = new ethers.Contract(CONTRACT_ADDRESSES.HERMES, HERMES_ABI, wallet);
    
    // Get all users from contract
    let userCount = 0;
    try {
      userCount = Number(await fundContract.getUserCount());
    } catch (e) {
      console.log('[AUTO-PROCESS-V2] getUserCount failed, trying event logs...');
    }
    
    const userAddresses: string[] = [];
    
    // Method 1: Get from users array
    if (userCount > 0) {
      for (let i = 0; i < userCount; i++) {
        try {
          const addr = await fundContract.users(i);
          if (addr) userAddresses.push(addr);
        } catch (e) {
          break;
        }
      }
    }
    
    // Method 2: Get from event logs (catch any missed users)
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100000); // Look back ~4 days
      
      const eventTopic = ethers.id('Joined(address,uint8,uint256,uint256)');
      const logs = await provider.getLogs({
        address: CONTRACT_ADDRESSES.FUND,
        topics: [eventTopic],
        fromBlock,
        toBlock: 'latest'
      });
      
      const existingUsers = new Set(userAddresses.map(a => a.toLowerCase()));
      
      for (const log of logs) {
        if (log.topics[1]) {
          const addr = ethers.getAddress('0x' + log.topics[1].slice(26));
          if (!existingUsers.has(addr.toLowerCase())) {
            userAddresses.push(addr);
            existingUsers.add(addr.toLowerCase());
          }
        }
      }
    } catch (e) {
      console.error('[AUTO-PROCESS-V2] Event log scan failed:', e);
    }
    
    console.log(`[AUTO-PROCESS-V2] Found ${userAddresses.length} users to check`);
    
    // Check each user for pending claims
    for (const userAddress of userAddresses) {
      try {
        // Fetch pending states and position
        const [pendingUsdt, pendingHermes, pendingUsdtWithdraw, pendingHermesUnstake, position] = await Promise.all([
          fundContract.pendingUsdtClaim(userAddress),      // uint256 amount
          fundContract.pendingHermesClaim(userAddress),    // uint256 amount
          fundContract.pendingUsdtWithdraw(userAddress),   // bool (NOT amount!)
          fundContract.pendingHermesUnstake(userAddress),  // bool (NOT amount!)
          fundContract.positions(userAddress)              // position struct
        ]);
        
        // Get amounts from position for withdraw/unstake
        const usdtPrincipal = position.usdtPrincipal;
        const hermesStaked = position.hermesStaked;
        
        // Process USDT Claim (yield — apply reduction)
        if (pendingUsdt > 0n) {
          const reducedUsdt = pendingUsdt * BigInt(Math.floor(YIELD_REDUCTION * 1000)) / 1000n;
          console.log(`[AUTO-PROCESS-V2] Processing USDT claim for ${userAddress}: contract=${weiToNumber(pendingUsdt)}, sending=${weiToNumber(reducedUsdt)} (${YIELD_REDUCTION * 100}%)`);
          try {
            const transferTx = await usdtContract.transfer(userAddress, reducedUsdt);
            await transferTx.wait();
            
            const markTx = await fundContractWrite.markUsdtClaimPaid(userAddress);
            await markTx.wait();
            
            results.push({
              user: userAddress,
              type: 'usdt_claim',
              amount: weiToNumber(reducedUsdt),
              status: 'success',
              txHash: transferTx.hash
            });
            console.log(`[AUTO-PROCESS-V2] ✅ USDT claim processed (reduced): ${transferTx.hash}`);
          } catch (e: any) {
            console.error(`[AUTO-PROCESS-V2] ❌ USDT claim failed:`, e.message);
            results.push({
              user: userAddress,
              type: 'usdt_claim',
              amount: weiToNumber(reducedUsdt),
              status: 'failed',
              error: e.message
            });
          }
        }
        
        // Process HERMES Claim (yield — apply reduction)
        if (pendingHermes > 0n) {
          const reducedHermes = pendingHermes * BigInt(Math.floor(YIELD_REDUCTION * 1000)) / 1000n;
          console.log(`[AUTO-PROCESS-V2] Processing HERMES claim for ${userAddress}: contract=${weiToNumber(pendingHermes)}, sending=${weiToNumber(reducedHermes)} (${YIELD_REDUCTION * 100}%)`);
          try {
            const transferTx = await hermesContract.transfer(userAddress, reducedHermes);
            await transferTx.wait();
            
            const markTx = await fundContractWrite.markHermesClaimPaid(userAddress);
            await markTx.wait();
            
            results.push({
              user: userAddress,
              type: 'hermes_claim',
              amount: weiToNumber(reducedHermes),
              status: 'success',
              txHash: transferTx.hash
            });
            console.log(`[AUTO-PROCESS-V2] ✅ HERMES claim processed (reduced): ${transferTx.hash}`);
          } catch (e: any) {
            console.error(`[AUTO-PROCESS-V2] ❌ HERMES claim failed:`, e.message);
            results.push({
              user: userAddress,
              type: 'hermes_claim',
              amount: weiToNumber(reducedHermes),
              status: 'failed',
              error: e.message
            });
          }
        }
        
        // Process USDT Withdraw (pendingUsdtWithdraw is BOOLEAN, amount from position)
        if (pendingUsdtWithdraw && usdtPrincipal > 0n) {
          console.log(`[AUTO-PROCESS-V2] Processing USDT withdraw for ${userAddress}: ${weiToNumber(usdtPrincipal)}`);
          try {
            const transferTx = await usdtContract.transfer(userAddress, usdtPrincipal);
            await transferTx.wait();
            
            const markTx = await fundContractWrite.markUsdtWithdrawPaid(userAddress);
            await markTx.wait();
            
            results.push({
              user: userAddress,
              type: 'usdt_withdraw',
              amount: weiToNumber(usdtPrincipal),
              status: 'success',
              txHash: transferTx.hash
            });
            console.log(`[AUTO-PROCESS-V2] ✅ USDT withdraw processed: ${transferTx.hash}`);
          } catch (e: any) {
            console.error(`[AUTO-PROCESS-V2] ❌ USDT withdraw failed:`, e.message);
            results.push({
              user: userAddress,
              type: 'usdt_withdraw',
              amount: weiToNumber(usdtPrincipal),
              status: 'failed',
              error: e.message
            });
          }
        }
        
        // Process HERMES Unstake (pendingHermesUnstake is BOOLEAN, amount from position)
        if (pendingHermesUnstake && hermesStaked > 0n) {
          console.log(`[AUTO-PROCESS-V2] Processing HERMES unstake for ${userAddress}: ${weiToNumber(hermesStaked)}`);
          try {
            const transferTx = await hermesContract.transfer(userAddress, hermesStaked);
            await transferTx.wait();
            
            const markTx = await fundContractWrite.markHermesUnstakePaid(userAddress);
            await markTx.wait();
            
            results.push({
              user: userAddress,
              type: 'hermes_unstake',
              amount: weiToNumber(hermesStaked),
              status: 'success',
              txHash: transferTx.hash
            });
            console.log(`[AUTO-PROCESS-V2] ✅ HERMES unstake processed: ${transferTx.hash}`);
          } catch (e: any) {
            console.error(`[AUTO-PROCESS-V2] ❌ HERMES unstake failed:`, e.message);
            results.push({
              user: userAddress,
              type: 'hermes_unstake',
              amount: weiToNumber(hermesStaked),
              status: 'failed',
              error: e.message
            });
          }
        }
        
      } catch (e: any) {
        console.error(`[AUTO-PROCESS-V2] Error checking user ${userAddress}:`, e.message);
      }
    }
    
    const summary = {
      totalUsers: userAddresses.length,
      processed: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length
    };
    
    console.log(`[AUTO-PROCESS-V2] Completed: ${JSON.stringify(summary)}`);
    
    return NextResponse.json({
      success: true,
      summary,
      results,
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('[AUTO-PROCESS-V2] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
}

