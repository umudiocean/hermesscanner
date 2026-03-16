// HERMES AI Fund - Type Tanımları
// V2: 3 Planlı Sistem + 1B HERMES Stake

// ═══════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════════

export enum DepositStatus {
  NONE = 0,       // Kayıt yok
  ACTIVE = 1,     // Aktif
  MATURED = 2,    // Vadesi doldu
  UNLOCKED = 3,   // Çekilebilir (+24h)
  CLOSED = 4      // Kapatıldı
}

export enum PlanId {
  PLAN_1M = 0,    // 1 Ay
  PLAN_3M = 1,    // 3 Ay
  PLAN_6M = 2     // 6 Ay
}

// Plan Detayları
export const PLANS = [
  {
    id: PlanId.PLAN_1M,
    name: '1 Ay',
    nameEn: '1 Month',
    duration: 30,           // gün
    durationSeconds: 30 * 24 * 60 * 60,
    usdtYield: 10,          // %10
    usdtBps: 1000,
    hermesYield: 7,         // %7
    hermesBps: 700,
    highlight: false
  },
  {
    id: PlanId.PLAN_3M,
    name: '3 Ay',
    nameEn: '3 Months',
    duration: 90,
    durationSeconds: 90 * 24 * 60 * 60,
    usdtYield: 37.5,        // %37.5
    usdtBps: 3750,
    hermesYield: 24,        // %24
    hermesBps: 2400,
    highlight: false
  },
  {
    id: PlanId.PLAN_6M,
    name: '6 Ay',
    nameEn: '6 Months',
    duration: 180,
    durationSeconds: 180 * 24 * 60 * 60,
    usdtYield: 90,          // %90
    usdtBps: 9000,
    hermesYield: 54,        // %54
    hermesBps: 5400,
    highlight: true         // HOT - 6 Aylık en popüler
  }
] as const;

export const FUND_CONSTANTS = {
  // Stake Gereksinimleri
  HERMES_STAKE_REQUIRED: 1_000_000_000,  // 1B HERMES zorunlu stake
  UNSTAKE_DELAY_HOURS: 24,               // Vade +24h sonra unstake
  CLAIM_COOLDOWN_HOURS: 24,              // 24 saat claim cooldown
  
  // Deposit Limitleri
  MIN_DEPOSIT_USDT: 100,                 // Min 100 USDT
  MAX_DEPOSIT_USDT: 1000,                // Max 1000 USDT
  TVL_CAP_USDT: 100_000,                 // 100K USDT toplam havuz
  
  // Contract Addresses (BSC Mainnet)
  TREASURY_ADDRESS: '0xd63231a1f696968841b71e330caafd43097ba7f8',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  HERMES_ADDRESS: '0x9495aB3549338BF14aD2F86CbcF79C7b574bba37',
  FUND_CONTRACT_ADDRESS: '0x52A878b8385d66FE6E37656042036E058FE9850A', // Yeni V2 Contract
} as const;

// Renk teması
export const FUND_THEME = {
  primary: '#C49E1C',      // Altın sarısı
  secondary: '#6D2D55',    // Bordo/Mor
  accent: '#B7ADD5',       // Lavanta
  background: '#0D0D0D',   // Koyu arka plan
  surface: '#1A1A1A',      // Kart arka planı
  surfaceHover: '#252525', // Hover
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;

// ═══════════════════════════════════════════════════════════════
// USER TYPES
// ═══════════════════════════════════════════════════════════════

export interface Position {
  planId: PlanId;
  status: DepositStatus;
  
  // Principals
  usdtPrincipal: number;           // USDT yatırım miktarı
  hermesStaked: number;            // 1B HERMES stake
  
  // Timestamps
  startTime: number;               // Unix timestamp
  endTime: number;                 // Vade bitiş
  unlockTime: number;              // Unstake aktif olduğu zaman
  
  // Claimed totals
  claimedUsdt: number;
  claimedHermes: number;
  
  // Claim cooldowns
  lastClaimUsdtTime: number;
  lastClaimHermesTime: number;
  
  // Completion flags
  usdtPaid: boolean;
  hermesUnstaked: boolean;
}

export interface UserInfo {
  position: Position;
  
  // Hesaplanmış değerler
  earnedUsdt: number;              // Şu ana kadar kazanılan USDT
  earnedHermes: number;            // Şu ana kadar kazanılan HERMES
  claimableUsdt: number;           // Claim edilebilir USDT
  claimableHermes: number;         // Claim edilebilir HERMES
  
  // Plan detayları
  plan: typeof PLANS[number];
  
  // Durum
  daysElapsed: number;
  daysRemaining: number;
  progressPercent: number;
  
  // Cooldown durumları
  canClaimUsdt: boolean;
  canClaimHermes: boolean;
  canWithdrawUsdt: boolean;
  canUnstakeHermes: boolean;
  
  // Sonraki claim zamanları
  nextClaimUsdtTime: number;
  nextClaimHermesTime: number;
  
  // Pending request durumları
  hasPendingUsdtClaim: boolean;
  hasPendingHermesClaim: boolean;
  hasPendingUsdtWithdraw: boolean;
  hasPendingHermesUnstake: boolean;
}

export interface EligibilityCheck {
  hasEnoughHermes: boolean;
  currentHermesBalance: number;
  requiredHermesStake: number;
  deficit: number;
  hasEnoughUsdt: boolean;
  currentUsdtBalance: number;
}

// ═══════════════════════════════════════════════════════════════
// FUND STATS TYPES
// ═══════════════════════════════════════════════════════════════

export interface FundStats {
  // Global counters
  totalStakedHermes: number;       // Aktif stake edilen toplam HERMES
  totalStakedUsdt: number;         // Aktif USDT principal
  totalGeneratedHermes: number;    // Toplam üretilen HERMES (lifetime)
  totalGeneratedUsdt: number;      // Toplam üretilen USDT (lifetime)
  totalClaimedHermes: number;      // Toplam claim edilen HERMES
  totalClaimedUsdt: number;        // Toplam claim edilen USDT
  activeUserCount: number;         // Aktif kullanıcı sayısı
  
  // Limits
  minDeposit: number;
  maxDeposit: number;
  tvlCap: number;
  availableCapacity: number;       // Kalan kapasite
  
  // Hesaplanmış
  utilizationPercent: number;      // Doluluk oranı
  averageDeposit: number;          // Ortalama yatırım
  isFull: boolean;                 // Havuz dolu mu?
}

export interface DailyClaimStats {
  date: string;                    // YYYY-MM-DD
  usdtClaimed: number;
  hermesClaimed: number;
  usdtEarned: number;
  hermesEarned: number;
  totalClaimed: number;             // Toplam claim edilen USDT (usdtClaimed için kullanılır)
  claimCount?: number;              // O gün claim yapan kullanıcı sayısı (opsiyonel)
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTION TYPES
// ═══════════════════════════════════════════════════════════════

export interface PendingRequest {
  user: string;
  type: 'usdt_claim' | 'hermes_claim' | 'usdt_withdraw' | 'hermes_unstake';
  amount: number;
  requestedAt: number;
  txHash?: string;
}

export interface FundTransaction {
  id: string;
  type: 'join' | 'claim_usdt' | 'claim_hermes' | 'withdraw_usdt' | 'unstake_hermes';
  user: string;
  amount: number;
  planId?: PlanId;
  timestamp: number;
  txHash: string;
  blockNumber: number;
  status: 'pending' | 'confirmed' | 'failed';
}

// ═══════════════════════════════════════════════════════════════
// EVENT TYPES (Blockchain Events)
// ═══════════════════════════════════════════════════════════════

export interface JoinedEvent {
  user: string;
  planId: PlanId;
  usdtAmount: string;
  hermesStaked: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

export interface ClaimRequestedEvent {
  user: string;
  isUsdt: boolean;
  amount: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

export interface WithdrawRequestedEvent {
  user: string;
  isUsdt: boolean;
  amount: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

// ═══════════════════════════════════════════════════════════════
// API REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

export interface JoinRequest {
  planId: PlanId;
  usdtAmount: number;
  walletAddress: string;
}

export interface ClaimResponse {
  success: boolean;
  type: 'usdt' | 'hermes';
  claimedAmount?: number;
  txHash?: string;
  error?: string;
  nextClaimTime?: number;
}

export interface FundStatsResponse {
  success: boolean;
  stats: FundStats;
  dailyClaims: DailyClaimStats[];
  timestamp: number;
}

export interface UserInfoResponse {
  success: boolean;
  userInfo: UserInfo | null;
  eligibility: EligibilityCheck;
}

// ═══════════════════════════════════════════════════════════════
// ADMIN TYPES
// ═══════════════════════════════════════════════════════════════

export interface AdminPendingPayment {
  id: string;
  type: 'usdt_claim' | 'hermes_claim' | 'usdt_withdraw' | 'hermes_unstake';
  user: string;
  amount: number;
  planId?: PlanId;
  requestedAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: number;
  txHash?: string;
  notes?: string;
}

export interface AdminDashboardStats {
  fundStats: FundStats;
  pendingClaims: AdminPendingPayment[];
  pendingWithdrawals: AdminPendingPayment[];
  pendingUnstakes?: AdminPendingPayment[];  // Opsiyonel: eski uyumluluk için
  todaysClaims: number;  // Bugünkü toplam claim
  todaysUsdtClaims?: number;  // Opsiyonel: eski uyumluluk için
  todaysHermesClaims?: number;  // Opsiyonel: eski uyumluluk için
  todaysDeposits: number;
  treasuryBalance: number;
}

// ═══════════════════════════════════════════════════════════════
// UI STATE TYPES
// ═══════════════════════════════════════════════════════════════

export interface FundUIState {
  isLoading: boolean;
  isConnected: boolean;
  walletAddress: string | null;
  chainId: number | null;
  userInfo: UserInfo | null;
  fundStats: FundStats | null;
  eligibility: EligibilityCheck | null;
  selectedPlan: PlanId | null;
  error: string | null;
  
  // Transaction states
  isJoining: boolean;
  isClaimingUsdt: boolean;
  isClaimingHermes: boolean;
  isWithdrawingUsdt: boolean;
  isUnstakingHermes: boolean;
  pendingTx: string | null;
}

export interface DepositFormState {
  selectedPlan: PlanId | null;
  amount: string;
  isApproving: boolean;
  isApprovingHermes: boolean;
  isJoining: boolean;
  approvalTx: string | null;
  joinTx: string | null;
  error: string | null;
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getStatusLabel(status: DepositStatus): 'none' | 'active' | 'matured' | 'unlocked' | 'closed' | 'unknown' {
  switch (status) {
    case DepositStatus.NONE: return 'none';
    case DepositStatus.ACTIVE: return 'active';
    case DepositStatus.MATURED: return 'matured';
    case DepositStatus.UNLOCKED: return 'unlocked';
    case DepositStatus.CLOSED: return 'closed';
    default: return 'unknown';
  }
}

export function getStatusColor(status: DepositStatus): string {
  switch (status) {
    case DepositStatus.ACTIVE: return FUND_THEME.primary;
    case DepositStatus.MATURED: return FUND_THEME.warning;
    case DepositStatus.UNLOCKED: return FUND_THEME.success;
    case DepositStatus.CLOSED: return FUND_THEME.textMuted;
    default: return FUND_THEME.textMuted;
  }
}

export function getPlanById(planId: PlanId): typeof PLANS[number] {
  return PLANS[planId];
}

export function formatUSDT(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatHermes(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`;
  }
  return amount.toFixed(2);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Yield reduction factor — calculations use reduced rates while UI shows original
const YIELD_REDUCTION_FACTOR = 0.5;

export function calculatePlanYield(planId: PlanId, usdtAmount: number): {
  totalUsdtYield: number;
  totalHermesYield: number;
  dailyUsdtYield: number;
  dailyHermesYield: number;
} {
  const plan = getPlanById(planId);
  const hermesStake = FUND_CONSTANTS.HERMES_STAKE_REQUIRED;
  
  const totalUsdtYield = usdtAmount * (plan.usdtYield / 100) * YIELD_REDUCTION_FACTOR;
  const totalHermesYield = hermesStake * (plan.hermesYield / 100) * YIELD_REDUCTION_FACTOR;
  
  return {
    totalUsdtYield,
    totalHermesYield,
    dailyUsdtYield: totalUsdtYield / plan.duration,
    dailyHermesYield: totalHermesYield / plan.duration,
  };
}

/**
 * Calculate real-time earnings for a simulated position
 * Uses the same logic as the contract's _earnedUsdt and _earnedHermes functions
 */
export function calculateLiveEarnings(
  planId: PlanId,
  usdtAmount: number,
  simulatedStartTime: number // Unix timestamp
): {
  earnedUsdt: number;
  earnedHermes: number;
  elapsedSeconds: number;
  progressPercent: number;
} {
  const plan = getPlanById(planId);
  const hermesStake = FUND_CONSTANTS.HERMES_STAKE_REQUIRED;
  
  const now = Math.floor(Date.now() / 1000);
  const duration = plan.durationSeconds;
  const endTime = simulatedStartTime + duration;
  const t = now > endTime ? endTime : now;
  
  if (t <= simulatedStartTime) {
    return {
      earnedUsdt: 0,
      earnedHermes: 0,
      elapsedSeconds: 0,
      progressPercent: 0,
    };
  }
  
  const elapsed = t - simulatedStartTime;
  
  // Contract logic: (total * elapsed) / duration
  const totalUsdtYield = (usdtAmount * plan.usdtBps) / 10000 * YIELD_REDUCTION_FACTOR;
  const totalHermesYield = (hermesStake * plan.hermesBps) / 10000 * YIELD_REDUCTION_FACTOR;
  
  const earnedUsdt = (totalUsdtYield * elapsed) / duration;
  const earnedHermes = (totalHermesYield * elapsed) / duration;
  const progressPercent = (elapsed / duration) * 100;
  
  return {
    earnedUsdt,
    earnedHermes,
    elapsedSeconds: elapsed,
    progressPercent: Math.min(progressPercent, 100),
  };
}

export function getTimeUntilNextClaim(lastClaimTime: number): number {
  const nextClaimTime = lastClaimTime + (FUND_CONSTANTS.CLAIM_COOLDOWN_HOURS * 60 * 60 * 1000);
  return Math.max(0, nextClaimTime - Date.now());
}

export function formatTimeRemaining(ms: number): { isNow: boolean; hours: number; minutes: number } {
  if (ms <= 0) return { isNow: true, hours: 0, minutes: 0 };
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return { isNow: false, hours, minutes };
}

export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatDaysRemaining(days: number, language: 'tr' | 'en' = 'en'): string {
  if (days <= 0) return language === 'tr' ? 'Vade doldu' : 'Matured';
  return language === 'tr' ? `${days} gün kaldı` : `${days} days left`;
}

// ═══════════════════════════════════════════════════════════════
// REDIS KEYS
// ═══════════════════════════════════════════════════════════════

export const FUND_REDIS_KEYS = {
  FUND_STATS: 'hermes:fund:v2:stats',
  USER_PREFIX: 'hermes:fund:v2:user:',
  PENDING_UNSTAKES: 'hermes:fund:v2:pendingUnstakes',
  PENDING_CLAIMS: 'hermes:fund:v2:pendingClaims',
  PENDING_WITHDRAWALS: 'hermes:fund:v2:pendingWithdrawals',
  TRANSACTIONS: 'hermes:fund:v2:transactions',
  DAILY_STATS_PREFIX: 'hermes:fund:v2:daily:',
  LAST_SYNC: 'hermes:fund:v2:lastSync',
} as const;
