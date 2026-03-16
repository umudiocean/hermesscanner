// HERMES AI Fund V2 - User Info API
// Smart contract'tan gerçek verileri çeker
import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider, Contract } from 'ethers';
import { 
  FUND_CONSTANTS,
  DepositStatus,
  PLANS,
  type UserInfo, 
  type EligibilityCheck, 
  type Position
} from '@/types/hermesFund';
import { 
  CONTRACT_ADDRESSES, 
  HERMES_FUND_ABI, 
  HERMES_ABI,
  USDT_ABI,
  isValidAddress,
  weiToNumber,
  parsePosition,
  buildUserInfo
} from '@/lib/hermes-fund/contract';

// BSC RPC URLs
const BSC_RPC_URLS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc-dataseed1.ninicoin.io/',
  'https://bsc.publicnode.com'
];

// Get provider with fallback
async function getProvider(): Promise<JsonRpcProvider> {
  for (const rpcUrl of BSC_RPC_URLS) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber(); // Test connection
      return provider;
    } catch {
      continue;
    }
  }
  throw new Error('All BSC RPC endpoints failed');
}

// Fetch user info from V2 smart contract
async function fetchUserInfoFromContract(address: string): Promise<{ 
  userInfo: UserInfo | null; 
  eligibility: EligibilityCheck 
}> {
  try {
    const provider = await getProvider();
    
    // Create contract instances
    const fundContract = new Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, provider);
    const hermesContract = new Contract(CONTRACT_ADDRESSES.HERMES, HERMES_ABI, provider);
    const usdtContract = new Contract(CONTRACT_ADDRESSES.USDT, USDT_ABI, provider);
    
    // Fetch all data in parallel
    const [
      positionData,
      claimableUsdt,
      claimableHermes,
      pendingUsdtClaim,
      pendingHermesClaim,
      pendingUsdtWithdraw,
      pendingHermesUnstake,
      hermesBalance,
      usdtBalance
    ] = await Promise.all([
      fundContract.positions(address),
      fundContract.claimableUsdt(address),
      fundContract.claimableHermes(address),
      fundContract.pendingUsdtClaim(address),
      fundContract.pendingHermesClaim(address),
      fundContract.pendingUsdtWithdraw(address),
      fundContract.pendingHermesUnstake(address),
      hermesContract.balanceOf(address),
      usdtContract.balanceOf(address)
    ]);

    // Parse position
    const position = parsePosition(positionData);

    // Build eligibility check
    const currentHermesBalance = weiToNumber(hermesBalance);
    const currentUsdtBalance = weiToNumber(usdtBalance);
    const requiredHermesStake = FUND_CONSTANTS.HERMES_STAKE_REQUIRED;
    
    const eligibility: EligibilityCheck = {
      hasEnoughHermes: currentHermesBalance >= requiredHermesStake,
      currentHermesBalance,
      requiredHermesStake,
      deficit: Math.max(0, requiredHermesStake - currentHermesBalance),
      hasEnoughUsdt: currentUsdtBalance >= FUND_CONSTANTS.MIN_DEPOSIT_USDT,
      currentUsdtBalance
    };

    // If no active position, return null userInfo
    if (position.status === DepositStatus.NONE || position.status === DepositStatus.CLOSED) {
      return { userInfo: null, eligibility };
    }

    // Build full user info
    const userInfo = buildUserInfo(
      position,
      weiToNumber(claimableUsdt),
      weiToNumber(claimableHermes),
      weiToNumber(pendingUsdtClaim),
      weiToNumber(pendingHermesClaim),
      pendingUsdtWithdraw,
      pendingHermesUnstake
    );

    return { userInfo, eligibility };

  } catch (error) {
    console.error('Failed to fetch user info from contract:', error);
    
    // Return default eligibility on error
    return { 
      userInfo: null, 
      eligibility: {
        hasEnoughHermes: false,
        currentHermesBalance: 0,
        requiredHermesStake: FUND_CONSTANTS.HERMES_STAKE_REQUIRED,
        deficit: FUND_CONSTANTS.HERMES_STAKE_REQUIRED,
        hasEnoughUsdt: false,
        currentUsdtBalance: 0
      }
    };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    // Adres validasyonu
    if (!address || !isValidAddress(address)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid wallet address'
      }, { status: 400 });
    }

    // Smart contract'tan gerçek verileri al
    const { userInfo, eligibility } = await fetchUserInfoFromContract(address);

    return NextResponse.json({
      success: true,
      userInfo,
      eligibility,
      contractAddress: CONTRACT_ADDRESSES.FUND,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('User info error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user info',
      userInfo: null,
      eligibility: {
        hasEnoughHermes: false,
        currentHermesBalance: 0,
        requiredHermesStake: FUND_CONSTANTS.HERMES_STAKE_REQUIRED,
        deficit: FUND_CONSTANTS.HERMES_STAKE_REQUIRED,
        hasEnoughUsdt: false,
        currentUsdtBalance: 0
      }
    }, { status: 500 });
  }
}
