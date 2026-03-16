// HERMES AI Fund V2 - Smart Contract Interaction Layer
// Web3 / Ethers.js integration for BSC

import { 
  FUND_CONSTANTS, 
  PLANS,
  DepositStatus, 
  PlanId,
  type Position,
  type UserInfo, 
  type FundStats, 
  type EligibilityCheck 
} from '@/types/hermesFund';

// BSC Mainnet Contract Addresses
export const CONTRACT_ADDRESSES = {
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  HERMES: '0x9495aB3549338BF14aD2F86CbcF79C7b574bba37',
  TREASURY: '0xd63231a1f696968841b71e330caafd43097ba7f8',
  FUND: '0x52A878b8385d66FE6E37656042036E058FE9850A', // HermesAIFund V2 Contract
} as const;

// ABI - V2 fonksiyonlar
export const HERMES_FUND_ABI = [
  // ═══════════════════════════════════════════════════════════════
  // READ FUNCTIONS
  // ═══════════════════════════════════════════════════════════════
  
  // Position struct
  {
    name: 'positions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'planId', type: 'uint8' },
      { name: 'status', type: 'uint8' },
      { name: 'usdtPaid', type: 'bool' },
      { name: 'hermesUnstaked', type: 'bool' },
      { name: 'usdtPrincipal', type: 'uint256' },
      { name: 'hermesStaked', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'claimedUsdt', type: 'uint256' },
      { name: 'claimedHermes', type: 'uint256' },
      { name: 'lastClaimUsdt', type: 'uint256' },
      { name: 'lastClaimHermes', type: 'uint256' }
    ]
  },
  
  // Global stats
  {
    name: 'totalStakedHermes',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'totalStakedUsdt',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'totalGeneratedHermes',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'totalGeneratedUsdt',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'totalClaimedHermes',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'totalClaimedUsdt',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'activeUserCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  
  // Limits
  {
    name: 'minDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'maxDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'tvlCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  
  // Plan arrays
  {
    name: 'planDurations',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'planUsdtBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'planHermesBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  
  // User-specific view functions
  {
    name: 'claimableUsdt',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'claimableHermes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'isUnlocked',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'getEndTime',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getUnlockTime',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  
  // Pending requests
  {
    name: 'pendingUsdtClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'pendingHermesClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'pendingUsdtWithdraw',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'pendingHermesUnstake',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  
  // User count
  {
    name: 'getUserCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'users',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }]
  },
  
  // Constants
  {
    name: 'STAKE_REQUIRED',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'UNSTAKE_DELAY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'claimCooldown',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  
  // ═══════════════════════════════════════════════════════════════
  // WRITE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════
  
  {
    name: 'join',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'planId', type: 'uint8' },
      { name: 'usdtAmount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    name: 'requestClaimUsdt',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'requestClaimHermes',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'requestWithdrawUsdt',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'requestUnstakeHermes',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  
  // ═══════════════════════════════════════════════════════════════
  // ADMIN FUNCTIONS - Mark as Paid (Auto-Process için)
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'markUsdtClaimPaid',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: []
  },
  {
    name: 'markHermesClaimPaid',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: []
  },
  {
    name: 'markUsdtWithdrawPaid',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: []
  },
  {
    name: 'markHermesUnstakePaid',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: []
  }
] as const;

// USDT ABI (approve, allowance, balanceOf, transfer)
export const USDT_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

// HERMES Token ABI
export const HERMES_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

// BSC Chain Config
export const BSC_CONFIG = {
  chainId: 56,
  chainName: 'BNB Smart Chain',
  rpcUrls: [
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.defibit.io/',
    'https://bsc-dataseed1.ninicoin.io/',
    'https://bsc.publicnode.com'
  ],
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  },
  blockExplorerUrls: ['https://bscscan.com/']
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Wei to number (18 decimals)
export function weiToNumber(wei: bigint | string): number {
  const value = typeof wei === 'string' ? BigInt(wei) : wei;
  return Number(value) / 1e18;
}

// Number to Wei (18 decimals)
export function numberToWei(num: number): bigint {
  return BigInt(Math.floor(num * 1e18));
}

// Helper: USDT to Wei
export function usdtToWei(usdt: number): bigint {
  return BigInt(Math.floor(usdt * 1e18));
}

// Helper: HERMES to Wei
export function hermesToWei(hermes: number): bigint {
  return BigInt(Math.floor(hermes * 1e18));
}

// Parse position from contract
// Note: Contract returns uint8 as bigint in ethers.js v6
export function parsePosition(data: readonly [
  bigint | number, bigint | number, boolean, boolean, bigint, bigint, bigint, bigint, bigint, bigint, bigint
]): Position {
  const [
    planIdRaw,
    statusRaw,
    usdtPaid,
    hermesUnstaked,
    usdtPrincipal,
    hermesStaked,
    startTime,
    claimedUsdt,
    claimedHermes,
    lastClaimUsdt,
    lastClaimHermes
  ] = data;

  // Convert bigint to number for enum comparison
  const planId = Number(planIdRaw) as PlanId;
  const status = Number(statusRaw) as DepositStatus;
  
  const plan = PLANS[planId] || PLANS[0];
  const startTimeNum = Number(startTime);
  const endTime = startTimeNum + plan.durationSeconds;
  const unlockTime = endTime + (FUND_CONSTANTS.UNSTAKE_DELAY_HOURS * 3600);

  return {
    planId,
    status,
    usdtPaid,
    hermesUnstaked,
    usdtPrincipal: weiToNumber(usdtPrincipal),
    hermesStaked: weiToNumber(hermesStaked),
    startTime: startTimeNum * 1000, // to ms
    endTime: endTime * 1000,
    unlockTime: unlockTime * 1000,
    claimedUsdt: weiToNumber(claimedUsdt),
    claimedHermes: weiToNumber(claimedHermes),
    lastClaimUsdtTime: Number(lastClaimUsdt) * 1000,
    lastClaimHermesTime: Number(lastClaimHermes) * 1000,
  };
}

// Build full UserInfo from position and additional data
export function buildUserInfo(
  position: Position,
  claimableUsdt: number,
  claimableHermes: number,
  pendingUsdtClaim: number,
  pendingHermesClaim: number,
  pendingUsdtWithdraw: boolean,
  pendingHermesUnstake: boolean
): UserInfo {
  const plan = PLANS[position.planId];
  const now = Date.now();
  
  // Days calculation
  const msElapsed = now - position.startTime;
  const msDuration = position.endTime - position.startTime;
  const daysElapsed = Math.min(plan.duration, Math.floor(msElapsed / (24 * 60 * 60 * 1000)));
  const daysRemaining = Math.max(0, plan.duration - daysElapsed);
  const progressPercent = Math.min(100, (msElapsed / msDuration) * 100);
  
  // Earned calculations (linear vesting)
  const earnedUsdt = (position.usdtPrincipal * plan.usdtYield / 100) * Math.min(1, msElapsed / msDuration);
  const earnedHermes = (position.hermesStaked * plan.hermesYield / 100) * Math.min(1, msElapsed / msDuration);
  
  // Cooldown checks
  const cooldownMs = FUND_CONSTANTS.CLAIM_COOLDOWN_HOURS * 60 * 60 * 1000;
  const nextClaimUsdtTime = position.lastClaimUsdtTime + cooldownMs;
  const nextClaimHermesTime = position.lastClaimHermesTime + cooldownMs;
  const canClaimUsdt = (position.lastClaimUsdtTime === 0 || now >= nextClaimUsdtTime) && claimableUsdt > 0 && pendingUsdtClaim === 0;
  const canClaimHermes = (position.lastClaimHermesTime === 0 || now >= nextClaimHermesTime) && claimableHermes > 0 && pendingHermesClaim === 0;
  
  // Unlock checks
  const isUnlocked = now >= position.unlockTime;
  const canWithdrawUsdt = isUnlocked && !position.usdtPaid && !pendingUsdtWithdraw;
  const canUnstakeHermes = isUnlocked && !position.hermesUnstaked && !pendingHermesUnstake;
  
  return {
    position,
    plan,
    earnedUsdt,
    earnedHermes,
    claimableUsdt,
    claimableHermes,
    daysElapsed,
    daysRemaining,
    progressPercent,
    canClaimUsdt,
    canClaimHermes,
    canWithdrawUsdt,
    canUnstakeHermes,
    nextClaimUsdtTime,
    nextClaimHermesTime,
    hasPendingUsdtClaim: pendingUsdtClaim > 0,
    hasPendingHermesClaim: pendingHermesClaim > 0,
    hasPendingUsdtWithdraw: pendingUsdtWithdraw,
    hasPendingHermesUnstake: pendingHermesUnstake,
  };
}

// Build FundStats from contract data
export function buildFundStats(data: {
  totalStakedHermes: bigint;
  totalStakedUsdt: bigint;
  totalGeneratedHermes: bigint;
  totalGeneratedUsdt: bigint;
  totalClaimedHermes: bigint;
  totalClaimedUsdt: bigint;
  activeUserCount: bigint;
  minDeposit: bigint;
  maxDeposit: bigint;
  tvlCap: bigint;
}): FundStats {
  const totalStakedUsdt = weiToNumber(data.totalStakedUsdt);
  const tvlCap = weiToNumber(data.tvlCap);
  const activeUserCount = Number(data.activeUserCount);
  const availableCapacity = tvlCap - totalStakedUsdt;
  const utilizationPercent = tvlCap > 0 ? (totalStakedUsdt / tvlCap) * 100 : 0;
  
  return {
    totalStakedHermes: weiToNumber(data.totalStakedHermes),
    totalStakedUsdt,
    totalGeneratedHermes: weiToNumber(data.totalGeneratedHermes),
    totalGeneratedUsdt: weiToNumber(data.totalGeneratedUsdt),
    totalClaimedHermes: weiToNumber(data.totalClaimedHermes),
    totalClaimedUsdt: weiToNumber(data.totalClaimedUsdt),
    activeUserCount,
    minDeposit: weiToNumber(data.minDeposit),
    maxDeposit: weiToNumber(data.maxDeposit),
    tvlCap,
    availableCapacity,
    utilizationPercent,
    averageDeposit: activeUserCount > 0 ? totalStakedUsdt / activeUserCount : 0,
    isFull: utilizationPercent >= 100,
  };
}

// Build EligibilityCheck
export function buildEligibility(
  hermesBalance: number,
  usdtBalance: number,
  minDeposit: number
): EligibilityCheck {
  const requiredHermes = FUND_CONSTANTS.HERMES_STAKE_REQUIRED;
  return {
    hasEnoughHermes: hermesBalance >= requiredHermes,
    currentHermesBalance: hermesBalance,
    requiredHermesStake: requiredHermes,
    deficit: Math.max(0, requiredHermes - hermesBalance),
    hasEnoughUsdt: usdtBalance >= minDeposit,
    currentUsdtBalance: usdtBalance,
  };
}

// Contract addresses getter
export function getContractAddresses() {
  return {
    fund: CONTRACT_ADDRESSES.FUND,
    usdt: CONTRACT_ADDRESSES.USDT,
    hermes: CONTRACT_ADDRESSES.HERMES,
    treasury: CONTRACT_ADDRESSES.TREASURY
  };
}

// Check if address is valid
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Format address for display
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Get block explorer URL
export function getExplorerUrl(hash: string, type: 'tx' | 'address' = 'tx'): string {
  return `https://bscscan.com/${type}/${hash}`;
}

// Get contract explorer URL
export function getContractExplorerUrl(): string {
  return getExplorerUrl(CONTRACT_ADDRESSES.FUND, 'address');
}
