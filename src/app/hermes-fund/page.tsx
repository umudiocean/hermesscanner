'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { BrowserProvider, Contract } from 'ethers';
import { checkSession } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { 
  FundHeader, 
  EligibilityCheck, 
  DepositForm, 
  UserDashboard,
  WalletConnect,
  PoolProgressBar
} from '@/components/hermes-fund';
import { 
  FUND_THEME, 
  FUND_CONSTANTS,
  PLANS,
  DepositStatus,
  PlanId,
  type FundStats,
  type UserInfo,
  type EligibilityCheck as EligibilityCheckType
} from '@/types/hermesFund';
import { 
  CONTRACT_ADDRESSES, 
  HERMES_FUND_ABI, 
  USDT_ABI,
  HERMES_ABI,
  usdtToWei,
  hermesToWei,
  weiToNumber,
  parsePosition,
  buildUserInfo
} from '@/lib/hermes-fund/contract';
import { hermesFetch } from '@/lib/api/hermesClient';
import { useToast, ToastProvider } from '@/components/ui/Toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { ethereum?: any } }

// Inner component that uses wallet hooks
function HermesFundContent() {
  const { language, setLanguage } = useLanguage();
  // Direct wallet provider from window.ethereum (MetaMask / injected)
  const [walletProvider, setWalletProvider] = useState<any>(typeof window !== 'undefined' ? window.ethereum : null);
  useEffect(() => { setWalletProvider(window.ethereum ?? null); }, []);
  const toast = useToast();
  
  // Stabilize walletProvider with ref to prevent unnecessary re-renders
  const walletProviderRef = useRef(walletProvider);
  useEffect(() => {
    walletProviderRef.current = walletProvider;
  }, [walletProvider]);
  
  // Admin auth state - sadece admin butonları için
  const [isAdmin, setIsAdmin] = useState(false);

  // Wallet state
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Transaction state
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Admin auth kontrolü - sadece admin butonlarının görünürlüğü için
  useEffect(() => {
    const session = checkSession();
    setIsAdmin(session.isAuthenticated);
  }, []);

  // Data state
  const [fundStats, setFundStats] = useState<FundStats | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityCheckType | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isClaimUsdtLoading, setIsClaimUsdtLoading] = useState(false);
  const [isClaimHermesLoading, setIsClaimHermesLoading] = useState(false);
  const [isWithdrawUsdtLoading, setIsWithdrawUsdtLoading] = useState(false);
  const [isUnstakeHermesLoading, setIsUnstakeHermesLoading] = useState(false);

  // Fetch fund stats from API with timeout and error handling
  const fetchFundStats = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    try {
      // Avoid any client-side caching; iOS Safari can be aggressive when tab resumes.
      // Add a cache-busting query param as an extra guard against intermediary caches.
      const res = await hermesFetch(`/api/hermes-fund/stats?ts=${Date.now()}`, { 
        cache: 'no-store' as any,
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      if (data.success) {
        setFundStats(data.stats);
      } else {
        throw new Error(data.error || 'Failed to fetch fund stats');
      }
    } catch (error: any) {
      console.error('Failed to fetch fund stats:', error);
      
      // User-friendly error handling
      if (error.name === 'AbortError') {
        toast?.error?.('Request timed out. Please try again.');
      } else {
        toast?.error?.('Failed to load fund data. Retrying...');
        
        // Retry once after 2s
        setTimeout(() => {
          fetchFundStats();
        }, 2000);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFundStats();
    const interval = setInterval(fetchFundStats, 15000);

    // iOS Safari often pauses timers in background; refresh on focus/visibility/online.
    const onFocus = () => fetchFundStats();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchFundStats();
    };
    const onOnline = () => fetchFundStats();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [fetchFundStats]);

  // Fetch user info when connected - use ref to prevent re-creation
  const fetchUserInfo = useCallback(async () => {
    const currentProvider = walletProviderRef.current;
    const currentAddress = connectedAddress;
    
    if (!currentProvider || !currentAddress) {
      setUserInfo(null);
      return;
    }

    try {
      const provider = new BrowserProvider(currentProvider);
      const fundContract = new Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, provider);

      // Fetch position
      const positionData = await fundContract.positions(currentAddress);
      const position = parsePosition(positionData);

      if (position.status === DepositStatus.NONE || position.status === DepositStatus.CLOSED) {
        setUserInfo(null);
        return;
      }

      // Fetch additional data
      const [claimableUsdt, claimableHermes, pendingUsdtClaim, pendingHermesClaim, pendingUsdtWithdraw, pendingHermesUnstake] = await Promise.all([
        fundContract.claimableUsdt(currentAddress),
        fundContract.claimableHermes(currentAddress),
        fundContract.pendingUsdtClaim(currentAddress),
        fundContract.pendingHermesClaim(currentAddress),
        fundContract.pendingUsdtWithdraw(currentAddress),
        fundContract.pendingHermesUnstake(currentAddress)
      ]);

      const info = buildUserInfo(
        position,
        weiToNumber(claimableUsdt),
        weiToNumber(claimableHermes),
        weiToNumber(pendingUsdtClaim),
        weiToNumber(pendingHermesClaim),
        pendingUsdtWithdraw,
        pendingHermesUnstake
      );

      setUserInfo(info);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      setUserInfo(null);
    }
  }, [connectedAddress]);

  // Use ref to stabilize fetchUserInfo in interval
  const fetchUserInfoRef = useRef(fetchUserInfo);
  useEffect(() => {
    fetchUserInfoRef.current = fetchUserInfo;
  }, [fetchUserInfo]);

  useEffect(() => {
    if (connectedAddress) {
      fetchUserInfo();
      // Refresh every 10 seconds to show real-time earnings (both USDT and HERMES calculate continuously per second)
      const interval = setInterval(() => {
        fetchUserInfoRef.current();
      }, 10000);
      return () => clearInterval(interval);
    } else {
      setUserInfo(null);
      setEligibility(null);
    }
  }, [connectedAddress, fetchUserInfo]);

  // Wallet handlers
  const handleConnect = useCallback((address: string) => {
    setConnectedAddress(address);
    setIsConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnectedAddress(null);
    setIsConnected(false);
    setUserInfo(null);
    setEligibility(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // ACTION HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleJoin = async (planId: PlanId, amount: number) => {
    const currentProvider = walletProviderRef.current;
    if (!currentProvider || !connectedAddress) {
      toast.warning(
        language === 'tr' ? 'Cüzdan Gerekli' : 'Wallet Required',
        language === 'tr' ? 'Lütfen önce cüzdanınızı bağlayın' : 'Please connect your wallet first'
      );
      return;
    }

    try {
      setTxStatus(language === 'tr' ? 'Cüzdan bağlanıyor...' : 'Connecting wallet...');
      const provider = new BrowserProvider(currentProvider);
      const signer = await provider.getSigner();

      const usdtContract = new Contract(CONTRACT_ADDRESSES.USDT, USDT_ABI, signer);
      const hermesContract = new Contract(CONTRACT_ADDRESSES.HERMES, HERMES_ABI, signer);
      const fundContract = new Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, signer);

      const amountWei = usdtToWei(amount);
      const stakeWei = hermesToWei(FUND_CONSTANTS.HERMES_STAKE_REQUIRED);

      // 1. Check USDT allowance
      setTxStatus(language === 'tr' ? 'USDT izni kontrol ediliyor...' : 'Checking USDT allowance...');
      const usdtAllowance = await usdtContract.allowance(connectedAddress, CONTRACT_ADDRESSES.FUND);
      
      if (usdtAllowance < amountWei) {
        setTxStatus(language === 'tr' ? 'USDT approve bekleniyor...' : 'Waiting for USDT approval...');
        const approveTx = await usdtContract.approve(CONTRACT_ADDRESSES.FUND, amountWei);
        setTxStatus(language === 'tr' ? 'USDT approve işleniyor...' : 'Processing USDT approval...');
        await approveTx.wait();
      }

      // 2. Check HERMES allowance
      setTxStatus(language === 'tr' ? 'HERMES izni kontrol ediliyor...' : 'Checking HERMES allowance...');
      const hermesAllowance = await hermesContract.allowance(connectedAddress, CONTRACT_ADDRESSES.FUND);
      
      if (hermesAllowance < stakeWei) {
        setTxStatus(language === 'tr' ? 'HERMES approve bekleniyor...' : 'Waiting for HERMES approval...');
        const approveHermesTx = await hermesContract.approve(CONTRACT_ADDRESSES.FUND, stakeWei);
        setTxStatus(language === 'tr' ? 'HERMES approve işleniyor...' : 'Processing HERMES approval...');
        await approveHermesTx.wait();
      }

      // 3. Join fund
      setTxStatus(language === 'tr' ? 'Fona katılım başlatılıyor...' : 'Joining fund...');
      const joinTx = await fundContract.join(planId, amountWei);
      
      setTxStatus(language === 'tr' ? 'İşlem onaylanıyor...' : 'Confirming transaction...');
      await joinTx.wait();

      setTxStatus(null);
      toast.success(
        language === 'tr' ? '🎉 Tebrikler!' : '🎉 Congratulations!',
        language === 'tr' 
          ? `${amount} USDT yatırdınız ve ${FUND_CONSTANTS.HERMES_STAKE_REQUIRED / 1e9}B HERMES stake ettiniz.`
          : `You deposited ${amount} USDT and staked ${FUND_CONSTANTS.HERMES_STAKE_REQUIRED / 1e9}B HERMES.`
      );
      
      // Refresh data
      fetchUserInfo();
      // IMPORTANT: Optimistically update global pool stats immediately (no waiting on RPC),
      // then reconcile by refetching from the server.
      setFundStats((prev) => {
        if (!prev) return prev;
        const nextTotalUsdt = prev.totalStakedUsdt + amount;
        const nextActiveUsers = prev.activeUserCount + 1;
        const nextAvailable = Math.max(0, prev.tvlCap - nextTotalUsdt);
        const nextUtil = prev.tvlCap > 0 ? (nextTotalUsdt / prev.tvlCap) * 100 : 0;
        return {
          ...prev,
          totalStakedUsdt: nextTotalUsdt,
          totalStakedHermes: prev.totalStakedHermes + FUND_CONSTANTS.HERMES_STAKE_REQUIRED,
          activeUserCount: nextActiveUsers,
          availableCapacity: nextAvailable,
          utilizationPercent: nextUtil,
          averageDeposit: nextActiveUsers > 0 ? nextTotalUsdt / nextActiveUsers : 0,
          isFull: nextUtil >= 100,
        };
      });
      // reconcile (slight delay helps RPCs that lag right after a tx is mined)
      setTimeout(() => {
        fetchFundStats();
      }, 2500);
    } catch (error: unknown) {
      console.error('Join error:', error);
      setTxStatus(null);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('user rejected')) {
        toast.warning(
          language === 'tr' ? 'İşlem İptal Edildi' : 'Transaction Cancelled',
          language === 'tr' ? 'İşlem reddedildi' : 'Transaction rejected by user'
        );
      } else {
        toast.error(
          language === 'tr' ? 'İşlem Başarısız' : 'Transaction Failed',
          errorMessage
        );
      }
    }
  };

  const handleClaimUsdt = async () => {
    const currentProvider = walletProviderRef.current;
    if (!currentProvider || !connectedAddress || !userInfo) return;

    setIsClaimUsdtLoading(true);
    try {
      setTxStatus(language === 'tr' ? 'USDT claim başlatılıyor...' : 'Starting USDT claim...');
      const provider = new BrowserProvider(currentProvider);
      const signer = await provider.getSigner();
      const fundContract = new Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, signer);

      const claimTx = await fundContract.requestClaimUsdt();
      setTxStatus(language === 'tr' ? 'Blockchain onayı bekleniyor...' : 'Waiting for blockchain confirmation...');
      await claimTx.wait();

      // INSTANT PROCESSING: Immediately process the claim (don't wait for cron)
      setTxStatus(language === 'tr' ? 'USDT transferi yapılıyor...' : 'Transferring USDT to your wallet...');
      try {
        const processRes = await fetch('/api/hermes-fund/process-contract-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: connectedAddress,
            type: 'usdt'
          })
        });
        const processData = await processRes.json();
        
        if (processData.success && processData.processed?.length > 0) {
          setTxStatus(null);
          toast.success(
            language === 'tr' ? '✅ USDT Gönderildi!' : '✅ USDT Sent!',
            language === 'tr' 
              ? `${processData.processed[0].amount.toFixed(2)} USDT cüzdanınıza aktarıldı`
              : `${processData.processed[0].amount.toFixed(2)} USDT transferred to your wallet`
          );
        } else {
          // Fallback to showing pending if instant process failed
          setTxStatus(null);
          toast.info(
            language === 'tr' ? 'Claim Talebi Alındı' : 'Claim Request Received',
            language === 'tr' ? 'Ödemeniz kısa sürede işlenecek' : 'Your payment will be processed shortly'
          );
        }
      } catch (processError) {
        console.error('Instant process failed:', processError);
        // Still show success for the claim request
        setTxStatus(null);
        toast.info(
          language === 'tr' ? 'Claim Talebi Alındı' : 'Claim Request Received',
          language === 'tr' ? 'Ödemeniz kısa sürede işlenecek' : 'Your payment will be processed shortly'
        );
      }
      
      fetchUserInfo();
      fetchFundStats();
    } catch (error: unknown) {
      console.error('Claim USDT error:', error);
      setTxStatus(null);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(
        language === 'tr' ? 'USDT Claim Başarısız' : 'USDT Claim Failed',
        errorMessage
      );
    } finally {
      setIsClaimUsdtLoading(false);
    }
  };

  const handleClaimHermes = async () => {
    const currentProvider = walletProviderRef.current;
    if (!currentProvider || !connectedAddress || !userInfo) return;

    setIsClaimHermesLoading(true);
    try {
      setTxStatus(language === 'tr' ? 'HERMES claim başlatılıyor...' : 'Starting HERMES claim...');
      const provider = new BrowserProvider(currentProvider);
      const signer = await provider.getSigner();
      const fundContract = new Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, signer);

      const claimTx = await fundContract.requestClaimHermes();
      setTxStatus(language === 'tr' ? 'Blockchain onayı bekleniyor...' : 'Waiting for blockchain confirmation...');
      await claimTx.wait();

      // INSTANT PROCESSING: Immediately process the claim (don't wait for cron)
      setTxStatus(language === 'tr' ? 'HERMES transferi yapılıyor...' : 'Transferring HERMES to your wallet...');
      try {
        const processRes = await fetch('/api/hermes-fund/process-contract-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: connectedAddress,
            type: 'hermes'
          })
        });
        const processData = await processRes.json();
        
        if (processData.success && processData.processed?.length > 0) {
          setTxStatus(null);
          const amount = processData.processed[0].amount;
          const formattedAmount = amount >= 1000 ? `${(amount/1000).toFixed(1)}K` : amount.toFixed(0);
          toast.success(
            language === 'tr' ? '✅ HERMES Gönderildi!' : '✅ HERMES Sent!',
            language === 'tr' 
              ? `${formattedAmount} HERMES cüzdanınıza aktarıldı`
              : `${formattedAmount} HERMES transferred to your wallet`
          );
        } else {
          // Fallback to showing pending if instant process failed
          setTxStatus(null);
          toast.info(
            language === 'tr' ? 'Claim Talebi Alındı' : 'Claim Request Received',
            language === 'tr' ? 'Ödemeniz kısa sürede işlenecek' : 'Your payment will be processed shortly'
          );
        }
      } catch (processError) {
        console.error('Instant process failed:', processError);
        // Still show success for the claim request
        setTxStatus(null);
        toast.info(
          language === 'tr' ? 'Claim Talebi Alındı' : 'Claim Request Received',
          language === 'tr' ? 'Ödemeniz kısa sürede işlenecek' : 'Your payment will be processed shortly'
        );
      }
      
      fetchUserInfo();
      fetchFundStats();
    } catch (error: unknown) {
      console.error('Claim HERMES error:', error);
      setTxStatus(null);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(
        language === 'tr' ? 'HERMES Claim Başarısız' : 'HERMES Claim Failed',
        errorMessage
      );
    } finally {
      setIsClaimHermesLoading(false);
    }
  };

  const handleWithdrawUsdt = async () => {
    const currentProvider = walletProviderRef.current;
    if (!currentProvider || !connectedAddress || !userInfo) return;

    setIsWithdrawUsdtLoading(true);
    try {
      setTxStatus(language === 'tr' ? 'USDT çekim başlatılıyor...' : 'Starting USDT withdrawal...');
      const provider = new BrowserProvider(currentProvider);
      const signer = await provider.getSigner();
      const fundContract = new Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, signer);

      const withdrawTx = await fundContract.requestWithdrawUsdt();
      setTxStatus(language === 'tr' ? 'Blockchain onayı bekleniyor...' : 'Waiting for blockchain confirmation...');
      await withdrawTx.wait();

      // INSTANT PROCESSING: Immediately process the withdrawal
      setTxStatus(language === 'tr' ? 'USDT transferi yapılıyor...' : 'Transferring USDT to your wallet...');
      try {
        const processRes = await fetch('/api/hermes-fund/process-contract-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: connectedAddress,
            type: 'usdt_withdraw'
          })
        });
        const processData = await processRes.json();
        
        if (processData.success && processData.processed?.length > 0) {
          setTxStatus(null);
          toast.success(
            language === 'tr' ? '✅ USDT Çekildi!' : '✅ USDT Withdrawn!',
            language === 'tr' 
              ? `${processData.processed[0].amount.toFixed(2)} USDT cüzdanınıza aktarıldı`
              : `${processData.processed[0].amount.toFixed(2)} USDT transferred to your wallet`
          );
        } else {
          setTxStatus(null);
          toast.info(
            language === 'tr' ? 'Çekim Talebi Alındı' : 'Withdrawal Request Received',
            language === 'tr' ? 'Çekiminiz kısa sürede işlenecek' : 'Your withdrawal will be processed shortly'
          );
        }
      } catch (processError) {
        console.error('Instant process failed:', processError);
        setTxStatus(null);
        toast.info(
          language === 'tr' ? 'Çekim Talebi Alındı' : 'Withdrawal Request Received',
          language === 'tr' ? 'Çekiminiz kısa sürede işlenecek' : 'Your withdrawal will be processed shortly'
        );
      }
      
      fetchUserInfo();
      fetchFundStats();
    } catch (error: unknown) {
      console.error('Withdraw USDT error:', error);
      setTxStatus(null);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(
        language === 'tr' ? 'USDT Çekim Başarısız' : 'USDT Withdrawal Failed',
        errorMessage
      );
    } finally {
      setIsWithdrawUsdtLoading(false);
    }
  };

  const handleUnstakeHermes = async () => {
    const currentProvider = walletProviderRef.current;
    if (!currentProvider || !connectedAddress || !userInfo) return;

    setIsUnstakeHermesLoading(true);
    try {
      setTxStatus(language === 'tr' ? 'HERMES unstake başlatılıyor...' : 'Starting HERMES unstake...');
      const provider = new BrowserProvider(currentProvider);
      const signer = await provider.getSigner();
      const fundContract = new Contract(CONTRACT_ADDRESSES.FUND, HERMES_FUND_ABI, signer);

      const unstakeTx = await fundContract.requestUnstakeHermes();
      setTxStatus(language === 'tr' ? 'Blockchain onayı bekleniyor...' : 'Waiting for blockchain confirmation...');
      await unstakeTx.wait();

      // INSTANT PROCESSING: Immediately process the unstake
      setTxStatus(language === 'tr' ? 'HERMES transferi yapılıyor...' : 'Transferring HERMES to your wallet...');
      try {
        const processRes = await fetch('/api/hermes-fund/process-contract-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: connectedAddress,
            type: 'hermes_unstake'
          })
        });
        const processData = await processRes.json();
        
        if (processData.success && processData.processed?.length > 0) {
          setTxStatus(null);
          const amount = processData.processed[0].amount;
          const formattedAmount = amount >= 1e9 ? `${(amount/1e9).toFixed(1)}B` : amount >= 1e6 ? `${(amount/1e6).toFixed(1)}M` : amount >= 1000 ? `${(amount/1000).toFixed(1)}K` : amount.toFixed(0);
          toast.success(
            language === 'tr' ? '✅ HERMES Unstake Tamamlandı!' : '✅ HERMES Unstaked!',
            language === 'tr' 
              ? `${formattedAmount} HERMES cüzdanınıza aktarıldı`
              : `${formattedAmount} HERMES transferred to your wallet`
          );
        } else {
          setTxStatus(null);
          toast.info(
            language === 'tr' ? 'Unstake Talebi Alındı' : 'Unstake Request Received',
            language === 'tr' ? 'İşleminiz kısa sürede tamamlanacak' : 'Your request will be processed shortly'
          );
        }
      } catch (processError) {
        console.error('Instant process failed:', processError);
        setTxStatus(null);
        toast.info(
          language === 'tr' ? 'Unstake Talebi Alındı' : 'Unstake Request Received',
          language === 'tr' ? 'İşleminiz kısa sürede tamamlanacak' : 'Your request will be processed shortly'
        );
      }
      
      fetchUserInfo();
      fetchFundStats();
    } catch (error: unknown) {
      console.error('Unstake HERMES error:', error);
      setTxStatus(null);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(
        language === 'tr' ? 'HERMES Unstake Başarısız' : 'HERMES Unstake Failed',
        errorMessage
      );
    } finally {
      setIsUnstakeHermesLoading(false);
    }
  };

  // Stabilize hasActiveDeposit calculation to prevent flickering
  const hasActiveDeposit = useMemo(() => {
    return userInfo !== null && 
      userInfo.position.status !== DepositStatus.NONE && 
      userInfo.position.status !== DepositStatus.CLOSED;
  }, [userInfo?.position.status]);

  // Fund is now PUBLIC - herkese açık
  // Admin butonu sadece admin için görünür, sayfa herkese açık

  return (
    <div className="min-h-screen" style={{ backgroundColor: FUND_THEME.background }}>
      {/* Transaction Status Overlay */}
      <AnimatePresence>
        {txStatus && (
          <motion.div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="p-8 rounded-2xl max-w-md mx-4 text-center relative overflow-hidden"
              style={{ 
                backgroundColor: FUND_THEME.surface,
                border: `2px solid ${FUND_THEME.primary}`,
              }}
            >
              {/* Animated Border */}
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{ 
                  background: `linear-gradient(90deg, transparent, ${FUND_THEME.primary}50, transparent)`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />

              <div className="relative z-10">
                <motion.div 
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${FUND_THEME.primary}20` }}
                  animate={{ 
                    boxShadow: [
                      `0 0 20px ${FUND_THEME.primary}40`,
                      `0 0 50px ${FUND_THEME.primary}60`,
                      `0 0 20px ${FUND_THEME.primary}40`
                    ]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <motion.svg 
                    className="w-10 h-10" 
                    viewBox="0 0 24 24"
                    style={{ color: FUND_THEME.primary }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </motion.svg>
                </motion.div>

                <h3 className="text-xl font-bold mb-2" style={{ color: FUND_THEME.text }}>
                  {language === 'tr' ? 'İşlem Sürüyor' : 'Processing'}
                </h3>
                <motion.p 
                  style={{ color: FUND_THEME.textMuted }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {txStatus}
                </motion.p>
                <p className="mt-4 text-sm" style={{ color: FUND_THEME.accent }}>
                  {language === 'tr' ? 'Lütfen pencereyi kapatmayın' : "Please don't close this window"}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <motion.nav 
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ 
          backgroundColor: `${FUND_THEME.background}90`,
          borderBottom: `1px solid ${FUND_THEME.primary}20`
        }}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Sol Taraf - Ana Sayfa ve Canlı İşlemler Butonları */}
          <div className="flex items-center gap-3">
            {/* Ana Sayfa Butonu - Efektli */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                href="/"
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm relative overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, ${FUND_THEME.surface}, ${FUND_THEME.background})`,
                  border: `1px solid ${FUND_THEME.primary}40`,
                  color: FUND_THEME.text
                }}
              >
                <motion.div
                  className="absolute inset-0 opacity-20"
                  style={{ background: `linear-gradient(90deg, transparent, ${FUND_THEME.primary}, transparent)` }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <svg className="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="relative z-10">{language === 'tr' ? 'Ana Sayfa' : 'Home'}</span>
              </Link>
            </motion.div>

            {/* Canlı İşlemler Butonu - Mega Efektli */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  `0 0 10px ${FUND_THEME.success}30`,
                  `0 0 25px ${FUND_THEME.success}50`,
                  `0 0 10px ${FUND_THEME.success}30`
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="rounded-lg"
            >
              <Link 
                href="/canli-islemler"
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm relative overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, ${FUND_THEME.success}20, ${FUND_THEME.success}10)`,
                  border: `2px solid ${FUND_THEME.success}`,
                  color: FUND_THEME.success
                }}
              >
                {/* Pulse Effect */}
                <motion.div
                  className="absolute inset-0 rounded-lg"
                  style={{ backgroundColor: FUND_THEME.success }}
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                {/* Shimmer */}
                <motion.div
                  className="absolute inset-0 opacity-30"
                  style={{ background: `linear-gradient(90deg, transparent, ${FUND_THEME.success}, transparent)` }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                {/* Live Indicator */}
                <motion.div
                  className="w-2 h-2 rounded-full relative z-10"
                  style={{ backgroundColor: FUND_THEME.success }}
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="relative z-10">{language === 'tr' ? 'CANLI İşlemler' : 'LIVE Trades'}</span>
                <motion.svg 
                  className="w-4 h-4 relative z-10" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </motion.svg>
              </Link>
            </motion.div>

            {/* Admin Panel Butonu - Sadece Admin için */}
            {isAdmin && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  boxShadow: [
                    `0 0 10px ${FUND_THEME.warning}30`,
                    `0 0 25px ${FUND_THEME.warning}50`,
                    `0 0 10px ${FUND_THEME.warning}30`
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="rounded-lg"
              >
                <Link 
                  href="/admin"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm relative overflow-hidden"
                  style={{ 
                    background: `linear-gradient(135deg, ${FUND_THEME.warning}20, ${FUND_THEME.warning}10)`,
                    border: `2px solid ${FUND_THEME.warning}`,
                    color: FUND_THEME.warning
                  }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-lg"
                    style={{ backgroundColor: FUND_THEME.warning }}
                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-0 opacity-30"
                    style={{ background: `linear-gradient(90deg, transparent, ${FUND_THEME.warning}, transparent)` }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="relative z-10">🔐</span>
                  <span className="relative z-10">{language === 'tr' ? 'Admin Panel' : 'Admin Panel'}</span>
                </Link>
              </motion.div>
            )}
          </div>
          
          {/* Sağ Taraf - Dil Seçimi ve Cüzdan */}
          <div className="flex items-center gap-3">
            {/* Dil Seçimi */}
            <motion.div 
              className="flex rounded-lg overflow-hidden"
              style={{ 
                backgroundColor: FUND_THEME.surface,
                border: `1px solid ${FUND_THEME.primary}30`
              }}
              whileHover={{ scale: 1.02 }}
            >
              <motion.button
                onClick={() => setLanguage('tr')}
                className="px-3 py-2 text-sm font-semibold transition-all relative"
                style={{ 
                  backgroundColor: language === 'tr' ? FUND_THEME.primary : 'transparent',
                  color: language === 'tr' ? '#000' : FUND_THEME.textMuted
                }}
                whileTap={{ scale: 0.95 }}
              >
                {language === 'tr' && (
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)` }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                <span className="relative z-10">🇹🇷 TR</span>
              </motion.button>
              <motion.button
                onClick={() => setLanguage('en')}
                className="px-3 py-2 text-sm font-semibold transition-all relative"
                style={{ 
                  backgroundColor: language === 'en' ? FUND_THEME.primary : 'transparent',
                  color: language === 'en' ? '#000' : FUND_THEME.textMuted
                }}
                whileTap={{ scale: 0.95 }}
              >
                {language === 'en' && (
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)` }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                <span className="relative z-10">🇺🇸 EN</span>
              </motion.button>
            </motion.div>

            <WalletConnect
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              connectedAddress={connectedAddress}
            />
          </div>
        </div>
      </motion.nav>

      {/* Header */}
      <FundHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Pool Progress */}
        {fundStats && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <PoolProgressBar stats={fundStats} isLoading={isLoading} />
          </motion.section>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: PLAN SEÇ - YATAY */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {/* Deposit Form or User Dashboard */}
          {/* Use AnimatePresence to prevent flickering during transitions */}
          <AnimatePresence mode="wait">
            {hasActiveDeposit && userInfo ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <UserDashboard
                  userInfo={userInfo}
                  onClaimUsdt={handleClaimUsdt}
                  onClaimHermes={handleClaimHermes}
                  onWithdrawUsdt={handleWithdrawUsdt}
                  onUnstakeHermes={handleUnstakeHermes}
                  isClaimUsdtLoading={isClaimUsdtLoading}
                  isClaimHermesLoading={isClaimHermesLoading}
                  isWithdrawUsdtLoading={isWithdrawUsdtLoading}
                  isUnstakeHermesLoading={isUnstakeHermesLoading}
                />
              </motion.div>
            ) : (
              <motion.div
                key="deposit-form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Eligibility Check - Sadece cüzdan bağlıyken ve deposit yoksa göster */}
                {isConnected && (
                  <EligibilityCheck
                    showConnectPrompt={false}
                    onEligibilityChange={(isEligible, hermesBalance, usdtBalance) => {
                      setEligibility({
                        hasEnoughHermes: isEligible,
                        currentHermesBalance: hermesBalance,
                        requiredHermesStake: FUND_CONSTANTS.HERMES_STAKE_REQUIRED,
                        deficit: Math.max(0, FUND_CONSTANTS.HERMES_STAKE_REQUIRED - hermesBalance),
                        hasEnoughUsdt: usdtBalance >= FUND_CONSTANTS.MIN_DEPOSIT_USDT,
                        currentUsdtBalance: usdtBalance
                      });
                    }}
                  />
                )}
                <DepositForm
                  fundStats={fundStats}
                  eligibility={eligibility}
                  hasActiveDeposit={hasActiveDeposit}
                  onJoin={handleJoin}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: CANLI İSTATİSTİKLER - YATAY */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {fundStats && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-xl p-6 relative overflow-hidden"
            style={{ 
              backgroundColor: FUND_THEME.surface,
              border: `1px solid ${FUND_THEME.primary}20`
            }}
          >
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3" style={{ color: FUND_THEME.text }}>
              <motion.div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: FUND_THEME.success }}
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              {language === 'tr' ? '📊 Canlı İstatistikler' : '📊 Live Statistics'}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Toplam Biriken USDT - Tüm stake edenlerin kazandığı toplam - YEŞİL */}
              <motion.div 
                className="p-4 rounded-xl text-center relative overflow-hidden"
                style={{ backgroundColor: `${FUND_THEME.success}10`, border: `2px solid ${FUND_THEME.success}40` }}
                whileHover={{ scale: 1.03, y: -2 }}
              >
                <motion.div
                  className="absolute inset-0 opacity-10"
                  style={{ background: `linear-gradient(90deg, transparent, ${FUND_THEME.success}, transparent)` }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="relative">
                  <div className="text-xs mb-1 flex items-center justify-center gap-1" style={{ color: FUND_THEME.textMuted }}>
                    {language === 'tr' ? 'Toplam Biriken USDT' : 'Total Accumulated USDT'}
                    <span className="text-xs" style={{ color: FUND_THEME.success }}>⚡</span>
                  </div>
                  <motion.div 
                    className="text-xl font-bold font-mono"
                    style={{ color: FUND_THEME.success }}
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    ${fundStats.totalGeneratedUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </motion.div>
                  <div className="text-xs mt-1" style={{ color: FUND_THEME.textMuted }}>
                    {language === 'tr' ? 'Sürekli artıyor' : 'Growing'}
                  </div>
                </div>
              </motion.div>

              {/* Toplam Biriken HERMES - Tüm stake edenlerin kazandığı toplam - ALTIN SARISI/TURUNCU */}
              <motion.div 
                className="p-4 rounded-xl text-center relative overflow-hidden"
                style={{ backgroundColor: `${FUND_THEME.primary}10`, border: `2px solid ${FUND_THEME.primary}40` }}
                whileHover={{ scale: 1.03, y: -2 }}
              >
                <motion.div
                  className="absolute inset-0 opacity-10"
                  style={{ background: `linear-gradient(90deg, transparent, ${FUND_THEME.primary}, transparent)` }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                />
                <div className="relative">
                  <div className="text-xs mb-1 flex items-center justify-center gap-1" style={{ color: FUND_THEME.textMuted }}>
                    {language === 'tr' ? 'Toplam Biriken HERMES' : 'Total Accumulated HERMES'}
                    <span className="text-xs" style={{ color: FUND_THEME.primary }}>⚡</span>
                  </div>
                  <motion.div 
                    className="text-xl font-bold font-mono"
                    style={{ color: FUND_THEME.primary }}
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  >
                    {fundStats.totalGeneratedHermes >= 1e9 
                      ? `${(fundStats.totalGeneratedHermes / 1e9).toFixed(2)}B`
                      : fundStats.totalGeneratedHermes >= 1e6
                      ? `${(fundStats.totalGeneratedHermes / 1e6).toFixed(2)}M`
                      : `${(fundStats.totalGeneratedHermes / 1e3).toFixed(2)}K`}
                  </motion.div>
                  <div className="text-xs mt-1" style={{ color: FUND_THEME.textMuted }}>
                    {language === 'tr' ? 'Sürekli artıyor' : 'Growing'}
                  </div>
                </div>
              </motion.div>

              {/* Toplam Dağıtılan USDT - Claim edilen - YEŞİL */}
              <motion.div 
                className="p-4 rounded-xl text-center"
                style={{ backgroundColor: `${FUND_THEME.success}10`, border: `1px solid ${FUND_THEME.success}30` }}
                whileHover={{ scale: 1.03, y: -2 }}
              >
                <div className="text-xs mb-1" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Toplam Dağıtılan USDT' : 'Total USDT Distributed'}
                </div>
                <motion.div 
                  className="text-xl font-bold"
                  style={{ color: FUND_THEME.success }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ${fundStats.totalClaimedUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </motion.div>
                <div className="text-xs mt-1" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Claim edilen' : 'Claimed'}
                </div>
              </motion.div>

              {/* Toplam Dağıtılan HERMES - Claim edilen - ALTIN SARISI/TURUNCU */}
              <motion.div 
                className="p-4 rounded-xl text-center"
                style={{ backgroundColor: `${FUND_THEME.primary}10`, border: `1px solid ${FUND_THEME.primary}30` }}
                whileHover={{ scale: 1.03, y: -2 }}
              >
                <div className="text-xs mb-1" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Toplam Dağıtılan HERMES' : 'Total HERMES Distributed'}
                </div>
                <motion.div 
                  className="text-xl font-bold"
                  style={{ color: FUND_THEME.primary }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                >
                  {fundStats.totalClaimedHermes >= 1e9
                    ? `${(fundStats.totalClaimedHermes / 1e9).toFixed(2)}B`
                    : fundStats.totalClaimedHermes >= 1e6
                    ? `${(fundStats.totalClaimedHermes / 1e6).toFixed(2)}M`
                    : `${(fundStats.totalClaimedHermes / 1e3).toFixed(2)}K`}
                </motion.div>
                <div className="text-xs mt-1" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Claim edilen' : 'Claimed'}
                </div>
              </motion.div>

              {/* Aktif Kullanıcı */}
              <motion.div 
                className="p-4 rounded-xl text-center"
                style={{ backgroundColor: `${FUND_THEME.warning}10`, border: `1px solid ${FUND_THEME.warning}30` }}
                whileHover={{ scale: 1.03, y: -2 }}
              >
                <div className="text-xs mb-1" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Aktif Kullanıcı' : 'Active Users'}
                </div>
                <motion.div 
                  className="text-xl font-bold"
                  style={{ color: FUND_THEME.warning }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                >
                  {fundStats.activeUserCount}
                </motion.div>
                <div className="text-xs mt-1" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Stake eden' : 'Staked'}
                </div>
              </motion.div>

              {/* Ortalama Yatırım */}
              <motion.div 
                className="p-4 rounded-xl text-center"
                style={{ backgroundColor: `${FUND_THEME.accent}10`, border: `1px solid ${FUND_THEME.accent}30` }}
                whileHover={{ scale: 1.03, y: -2 }}
              >
                <div className="text-xs mb-1" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'Ortalama Yatırım' : 'Average Deposit'}
                </div>
                <motion.div 
                  className="text-xl font-bold"
                  style={{ color: FUND_THEME.accent }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
                >
                  ${fundStats.averageDeposit?.toFixed(0) || '0'}
                </motion.div>
                <div className="text-xs mt-1" style={{ color: FUND_THEME.textMuted }}>
                  {language === 'tr' ? 'USDT' : 'USDT'}
                </div>
              </motion.div>
            </div>
          </motion.section>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: NASIL ÇALIŞIR - YATAY */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="rounded-xl p-6 relative overflow-hidden"
          style={{ 
            backgroundColor: FUND_THEME.surface,
            border: `1px solid ${FUND_THEME.secondary}20`
          }}
        >
          {/* Animated Background */}
          <motion.div
            className="absolute inset-0 opacity-5"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${FUND_THEME.primary}, transparent 70%)`
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.05, 0.1, 0.05]
            }}
            transition={{ duration: 5, repeat: Infinity }}
          />

          <div className="relative z-10">
            <motion.h3 
              className="text-xl font-bold mb-6 flex items-center gap-3"
              style={{ color: FUND_THEME.text }}
            >
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🚀
              </motion.span>
              {language === 'tr' ? 'Nasıl Çalışır?' : 'How It Works'}
            </motion.h3>
            
            {/* 4 Adım Yatay Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { 
                  step: '1', 
                  icon: '📋',
                  title: language === 'tr' ? 'Plan Seç' : 'Choose Plan',
                  desc: language === 'tr' ? '1, 3 veya 6 aylık planlardan birini seç' : 'Select 1, 3, or 6 month plan',
                  color: FUND_THEME.primary
                },
                { 
                  step: '2', 
                  icon: '🔒',
                  title: language === 'tr' ? '1B HERMES Stake' : 'Stake 1B HERMES',
                  desc: language === 'tr' ? 'Zorunlu 1 Milyar HERMES stake' : 'Required 1 Billion HERMES',
                  color: FUND_THEME.accent
                },
                { 
                  step: '3', 
                  icon: '💵',
                  title: language === 'tr' ? 'USDT Yatır' : 'Deposit USDT',
                  desc: language === 'tr' ? '100 - 1000 USDT arası' : '100-1000 USDT range',
                  color: FUND_THEME.success
                },
                { 
                  step: '4', 
                  icon: '💰',
                  title: language === 'tr' ? 'Günlük Kazanç' : 'Daily Earnings',
                  desc: language === 'tr' ? 'USDT ve HERMES kazan' : 'Earn USDT & HERMES',
                  color: FUND_THEME.warning
                },
              ].map((item, i) => (
                <motion.div 
                  key={item.step} 
                  className="p-4 rounded-xl text-center relative overflow-hidden"
                  style={{ 
                    backgroundColor: `${item.color}10`,
                    border: `1px solid ${item.color}30`
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  whileHover={{ scale: 1.03, y: -3 }}
                >
                  {/* Step Number Badge */}
                  <motion.div
                    className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: item.color, color: '#000' }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                  >
                    {item.step}
                  </motion.div>

                  <motion.div 
                    className="text-4xl mb-3 mt-2"
                    animate={{ 
                      rotate: [0, 5, -5, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
                  >
                    {item.icon}
                  </motion.div>
                  <div className="font-bold mb-1" style={{ color: item.color }}>
                    {item.title}
                  </div>
                  <div className="text-xs" style={{ color: FUND_THEME.textMuted }}>
                    {item.desc}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Admin Panel Link - Sadece Admin için */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <Link
              href="/admin/fund-admin"
              className="flex items-center justify-between p-6 rounded-xl transition-all hover:scale-[1.01]"
              style={{ 
                background: `linear-gradient(135deg, ${FUND_THEME.warning}15, ${FUND_THEME.warning}05)`,
                border: `2px solid ${FUND_THEME.warning}50`
              }}
            >
              <div className="flex items-center gap-4">
                <motion.div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${FUND_THEME.warning}20` }}
                  animate={{ 
                    boxShadow: [
                      `0 0 10px ${FUND_THEME.warning}30`,
                      `0 0 20px ${FUND_THEME.warning}50`,
                      `0 0 10px ${FUND_THEME.warning}30`
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🔐
                </motion.div>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: FUND_THEME.warning }}>
                    {language === 'tr' ? 'Fund Admin Paneli' : 'Fund Admin Panel'}
                  </h3>
                  <p className="text-sm" style={{ color: FUND_THEME.textMuted }}>
                    {language === 'tr' ? 'Kullanıcıları yönet, talepleri onayla' : 'Manage users, approve requests'}
                  </p>
                </div>
              </div>
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <svg className="w-8 h-8" style={{ color: FUND_THEME.warning }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </motion.div>
            </Link>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer 
        className="mt-16 py-8"
        style={{ 
          backgroundColor: FUND_THEME.surface,
          borderTop: `1px solid ${FUND_THEME.primary}20`
        }}
      >
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="text-sm" style={{ color: FUND_THEME.textMuted }}>
            © 2024 Hermes AI Fund
          </div>
        </div>
      </footer>
    </div>
  );
}

// Main page component wrapped with ToastProvider
export default function HermesFundPage() {
  return (
    <ToastProvider>
      <HermesFundContent />
    </ToastProvider>
  );
}
