// HERMES AI Fund - Process ALL Pending Operations from Smart Contract
// Handles: USDT Claim, HERMES Claim, USDT Withdraw, HERMES Unstake
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

// GET: Check ALL pending operations for a user from contract
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get('address');
  
  if (!userAddress) {
    return NextResponse.json({ 
      success: false, 
      error: 'address parameter required' 
    }, { status: 400 });
  }
  
  try {
    const provider = getProvider();
    const fundContract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, provider);
    
    // Fetch all pending states
    const [pendingUsdtClaim, pendingHermesClaim, pendingUsdtWithdraw, pendingHermesUnstake, position] = await Promise.all([
      fundContract.pendingUsdtClaim(userAddress),        // Returns uint256 (amount)
      fundContract.pendingHermesClaim(userAddress),      // Returns uint256 (amount)
      fundContract.pendingUsdtWithdraw(userAddress),     // Returns bool
      fundContract.pendingHermesUnstake(userAddress),    // Returns bool
      fundContract.positions(userAddress)                // Returns position struct
    ]);
    
    // Get amounts from position for withdraw/unstake
    const usdtPrincipal = position.usdtPrincipal;
    const hermesStaked = position.hermesStaked;
    
    return NextResponse.json({
      success: true,
      user: userAddress,
      // Claims return amounts
      pendingUsdtClaim: weiToNumber(pendingUsdtClaim),
      pendingHermesClaim: weiToNumber(pendingHermesClaim),
      // Withdraw/Unstake are booleans, show amounts from position if pending
      pendingUsdtWithdraw: pendingUsdtWithdraw ? weiToNumber(usdtPrincipal) : 0,
      pendingHermesUnstake: pendingHermesUnstake ? weiToNumber(hermesStaked) : 0,
      // Raw values
      hasPendingUsdtWithdraw: pendingUsdtWithdraw,
      hasPendingHermesUnstake: pendingHermesUnstake,
      hasPending: pendingUsdtClaim > 0n || pendingHermesClaim > 0n || pendingUsdtWithdraw || pendingHermesUnstake
    });
  } catch (error: any) {
    console.error('[PROCESS-GET] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST: Process pending operations for a user
// type: 'usdt' | 'usdt_claim' | 'hermes' | 'hermes_claim' | 'usdt_withdraw' | 'hermes_unstake' | 'all' | 'both'
export async function POST(request: NextRequest) {
  if (!TREASURY_PRIVATE_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'TREASURY_PRIVATE_KEY not configured' 
    }, { status: 500 });
  }
  
  try {
    const body = await request.json();
    const { userAddress, type } = body;
    
    if (!userAddress) {
      return NextResponse.json({ 
        success: false, 
        error: 'userAddress required' 
      }, { status: 400 });
    }
    
    const wallet = getTreasuryWallet();
    const fundContract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, wallet);
    const usdtContract = new ethers.Contract(CONTRACT_ADDRESSES.USDT, USDT_ABI, wallet);
    const hermesContract = new ethers.Contract(CONTRACT_ADDRESSES.HERMES, HERMES_ABI, wallet);
    
    const results: any = { success: true, processed: [], errors: [] };
    
    // Fetch all pending states and position
    const [pendingUsdtClaim, pendingHermesClaim, pendingUsdtWithdraw, pendingHermesUnstake, position] = await Promise.all([
      fundContract.pendingUsdtClaim(userAddress),        // uint256 amount
      fundContract.pendingHermesClaim(userAddress),      // uint256 amount
      fundContract.pendingUsdtWithdraw(userAddress),     // bool
      fundContract.pendingHermesUnstake(userAddress),    // bool
      fundContract.positions(userAddress)                // position struct
    ]);
    
    // Get amounts from position for withdraw/unstake
    const usdtPrincipal = position.usdtPrincipal;
    const hermesStaked = position.hermesStaked;
    
    console.log(`[PROCESS] User: ${userAddress}, Type: ${type}`);
    console.log(`[PROCESS] Pending USDT Claim: ${weiToNumber(pendingUsdtClaim)}`);
    console.log(`[PROCESS] Pending HERMES Claim: ${weiToNumber(pendingHermesClaim)}`);
    console.log(`[PROCESS] Pending USDT Withdraw: ${pendingUsdtWithdraw} (amount: ${weiToNumber(usdtPrincipal)})`);
    console.log(`[PROCESS] Pending HERMES Unstake: ${pendingHermesUnstake} (amount: ${weiToNumber(hermesStaked)})`);
    
    // Determine which operations to process based on type
    const shouldProcessUsdtClaim = type === 'usdt' || type === 'usdt_claim' || type === 'both' || type === 'all';
    const shouldProcessHermesClaim = type === 'hermes' || type === 'hermes_claim' || type === 'both' || type === 'all';
    const shouldProcessUsdtWithdraw = type === 'usdt_withdraw' || type === 'all';
    const shouldProcessHermesUnstake = type === 'hermes_unstake' || type === 'all';
    
    // Process USDT Claim (pending amount from pendingUsdtClaim)
    if (shouldProcessUsdtClaim && pendingUsdtClaim > 0n) {
      try {
        console.log(`[PROCESS] Transferring USDT claim: ${weiToNumber(pendingUsdtClaim)}...`);
        const transferTx = await usdtContract.transfer(userAddress, pendingUsdtClaim);
        await transferTx.wait();
        
        const markTx = await fundContract.markUsdtClaimPaid(userAddress);
        await markTx.wait();
        
        results.processed.push({
          type: 'usdt_claim',
          amount: weiToNumber(pendingUsdtClaim),
          transferTx: transferTx.hash,
          markPaidTx: markTx.hash
        });
        console.log(`[PROCESS] ✅ USDT claim processed: ${transferTx.hash}`);
      } catch (error: any) {
        console.error(`[PROCESS] ❌ USDT claim error:`, error.message);
        results.errors.push({ type: 'usdt_claim', error: error.message });
      }
    }
    
    // Process HERMES Claim (pending amount from pendingHermesClaim)
    if (shouldProcessHermesClaim && pendingHermesClaim > 0n) {
      try {
        console.log(`[PROCESS] Transferring HERMES claim: ${weiToNumber(pendingHermesClaim)}...`);
        const transferTx = await hermesContract.transfer(userAddress, pendingHermesClaim);
        await transferTx.wait();
        
        const markTx = await fundContract.markHermesClaimPaid(userAddress);
        await markTx.wait();
        
        results.processed.push({
          type: 'hermes_claim',
          amount: weiToNumber(pendingHermesClaim),
          transferTx: transferTx.hash,
          markPaidTx: markTx.hash
        });
        console.log(`[PROCESS] ✅ HERMES claim processed: ${transferTx.hash}`);
      } catch (error: any) {
        console.error(`[PROCESS] ❌ HERMES claim error:`, error.message);
        results.errors.push({ type: 'hermes_claim', error: error.message });
      }
    }
    
    // Process USDT Withdraw (bool flag, amount from position.usdtPrincipal)
    if (shouldProcessUsdtWithdraw && pendingUsdtWithdraw && usdtPrincipal > 0n) {
      try {
        console.log(`[PROCESS] Transferring USDT withdraw: ${weiToNumber(usdtPrincipal)}...`);
        const transferTx = await usdtContract.transfer(userAddress, usdtPrincipal);
        await transferTx.wait();
        
        const markTx = await fundContract.markUsdtWithdrawPaid(userAddress);
        await markTx.wait();
        
        results.processed.push({
          type: 'usdt_withdraw',
          amount: weiToNumber(usdtPrincipal),
          transferTx: transferTx.hash,
          markPaidTx: markTx.hash
        });
        console.log(`[PROCESS] ✅ USDT withdraw processed: ${transferTx.hash}`);
      } catch (error: any) {
        console.error(`[PROCESS] ❌ USDT withdraw error:`, error.message);
        results.errors.push({ type: 'usdt_withdraw', error: error.message });
      }
    }
    
    // Process HERMES Unstake (bool flag, amount from position.hermesStaked)
    if (shouldProcessHermesUnstake && pendingHermesUnstake && hermesStaked > 0n) {
      try {
        console.log(`[PROCESS] Transferring HERMES unstake: ${weiToNumber(hermesStaked)}...`);
        const transferTx = await hermesContract.transfer(userAddress, hermesStaked);
        await transferTx.wait();
        
        const markTx = await fundContract.markHermesUnstakePaid(userAddress);
        await markTx.wait();
        
        results.processed.push({
          type: 'hermes_unstake',
          amount: weiToNumber(hermesStaked),
          transferTx: transferTx.hash,
          markPaidTx: markTx.hash
        });
        console.log(`[PROCESS] ✅ HERMES unstake processed: ${transferTx.hash}`);
      } catch (error: any) {
        console.error(`[PROCESS] ❌ HERMES unstake error:`, error.message);
        results.errors.push({ type: 'hermes_unstake', error: error.message });
      }
    }
    
    if (results.processed.length === 0 && results.errors.length === 0) {
      results.message = 'No pending operations found for the specified type';
    }
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('[PROCESS] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// DELETE: Cancel pending operations (mark as paid without transfer)
export async function DELETE(request: NextRequest) {
  if (!TREASURY_PRIVATE_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'TREASURY_PRIVATE_KEY not configured' 
    }, { status: 500 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('address');
    const type = searchParams.get('type') || 'all';
    
    if (!userAddress) {
      return NextResponse.json({ 
        success: false, 
        error: 'address parameter required' 
      }, { status: 400 });
    }
    
    const wallet = getTreasuryWallet();
    const fundContract = new ethers.Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, wallet);
    
    const [pendingUsdtClaim, pendingHermesClaim, pendingUsdtWithdraw, pendingHermesUnstake, position] = await Promise.all([
      fundContract.pendingUsdtClaim(userAddress),
      fundContract.pendingHermesClaim(userAddress),
      fundContract.pendingUsdtWithdraw(userAddress),
      fundContract.pendingHermesUnstake(userAddress),
      fundContract.positions(userAddress)
    ]);
    
    const results: any = { success: true, cancelled: [] };
    
    // Cancel operations based on type
    if ((type === 'all' || type === 'usdt_claim') && pendingUsdtClaim > 0n) {
      try {
        const tx = await fundContract.markUsdtClaimPaid(userAddress);
        await tx.wait();
        results.cancelled.push({ type: 'usdt_claim', amount: weiToNumber(pendingUsdtClaim), txHash: tx.hash });
      } catch (error: any) {
        results.usdtClaimError = error.message;
      }
    }
    
    if ((type === 'all' || type === 'hermes_claim') && pendingHermesClaim > 0n) {
      try {
        const tx = await fundContract.markHermesClaimPaid(userAddress);
        await tx.wait();
        results.cancelled.push({ type: 'hermes_claim', amount: weiToNumber(pendingHermesClaim), txHash: tx.hash });
      } catch (error: any) {
        results.hermesClaimError = error.message;
      }
    }
    
    if ((type === 'all' || type === 'usdt_withdraw') && pendingUsdtWithdraw) {
      try {
        const tx = await fundContract.markUsdtWithdrawPaid(userAddress);
        await tx.wait();
        results.cancelled.push({ type: 'usdt_withdraw', amount: weiToNumber(position.usdtPrincipal), txHash: tx.hash });
      } catch (error: any) {
        results.usdtWithdrawError = error.message;
      }
    }
    
    if ((type === 'all' || type === 'hermes_unstake') && pendingHermesUnstake) {
      try {
        const tx = await fundContract.markHermesUnstakePaid(userAddress);
        await tx.wait();
        results.cancelled.push({ type: 'hermes_unstake', amount: weiToNumber(position.hermesStaked), txHash: tx.hash });
      } catch (error: any) {
        results.hermesUnstakeError = error.message;
      }
    }
    
    if (results.cancelled.length === 0) {
      results.message = 'No pending operations to cancel';
    }
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('[PROCESS-DELETE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
