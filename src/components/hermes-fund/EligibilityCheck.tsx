'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { useLanguage } from '@/lib/i18n';
import { FUND_THEME, formatHermes, FUND_CONSTANTS } from '@/types/hermesFund';
import { CONTRACTS, BSC_CHAIN_ID } from '@/lib/web3/config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { ethereum?: any } }

// Minimal ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

interface EligibilityCheckProps {
  onEligibilityChange?: (isEligible: boolean, hermesBalance: number, usdtBalance: number) => void;
  showConnectPrompt?: boolean;
}

export default function EligibilityCheckComponent({ 
  onEligibilityChange,
  showConnectPrompt = true
}: EligibilityCheckProps) {
  const { language } = useLanguage();
  // Direct wallet state from window.ethereum
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  
  useEffect(() => {
    const check = async () => {
      if (!window.ethereum) return;
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
          const chain = await window.ethereum.request({ method: 'eth_chainId' });
          setChainId(parseInt(chain, 16));
        }
      } catch {}
    };
    check();
    if (window.ethereum) {
      window.ethereum.on?.('accountsChanged', (accs: string[]) => {
        if (accs.length > 0) { setAddress(accs[0]); setIsConnected(true); } else { setAddress(null); setIsConnected(false); }
      });
      window.ethereum.on?.('chainChanged', (c: string) => setChainId(parseInt(c, 16)));
    }
  }, []);

  const walletProvider = typeof window !== 'undefined' ? window.ethereum : null;

  const [hermesBalance, setHermesBalance] = useState<number>(0);
  const [usdtBalance, setUsdtBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<number>(0);
  
  const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

  const isCorrectChain = useMemo(() => chainId === BSC_CHAIN_ID, [chainId]);
  const addressRef = useRef(address);
  const walletProviderRef = useRef(walletProvider);
  const onEligibilityChangeRef = useRef(onEligibilityChange);

  // Update refs when values change
  useEffect(() => {
    addressRef.current = address;
    walletProviderRef.current = walletProvider;
    onEligibilityChangeRef.current = onEligibilityChange;
  }, [address, walletProvider, onEligibilityChange]);

  const isEligible = hermesBalance >= FUND_CONSTANTS.HERMES_STAKE_REQUIRED;
  const deficit = Math.max(0, FUND_CONSTANTS.HERMES_STAKE_REQUIRED - hermesBalance);

  // Fetch HERMES and USDT balances - use refs to prevent re-creation
  const fetchBalance = useCallback(async () => {
    const currentAddress = addressRef.current;
    const currentProvider = walletProviderRef.current;
    
    if (!currentProvider || !currentAddress || !isCorrectChain) {
      setHermesBalance(0);
      setUsdtBalance(0);
      return;
    }

    setIsLoading(true);
    try {
      const provider = new BrowserProvider(currentProvider);
      const hermesContract = new Contract(CONTRACTS.HERMES, ERC20_ABI, provider);
      const usdtContract = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
      
      // Fetch both balances in parallel
      const [hermesBalanceRaw, hermesDecimals, usdtBalanceRaw, usdtDecimals] = await Promise.all([
        hermesContract.balanceOf(currentAddress),
        hermesContract.decimals(),
        usdtContract.balanceOf(currentAddress),
        usdtContract.decimals()
      ]);
      
      const hermesBalanceNum = parseFloat(formatUnits(hermesBalanceRaw, hermesDecimals));
      const usdtBalanceNum = parseFloat(formatUnits(usdtBalanceRaw, usdtDecimals));
      
      setHermesBalance(hermesBalanceNum);
      setUsdtBalance(usdtBalanceNum);
      setLastCheck(Date.now());
      
      if (onEligibilityChangeRef.current) {
        onEligibilityChangeRef.current(
          hermesBalanceNum >= FUND_CONSTANTS.HERMES_STAKE_REQUIRED, 
          hermesBalanceNum,
          usdtBalanceNum
        );
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
      setHermesBalance(0);
      setUsdtBalance(0);
    } finally {
      setIsLoading(false);
    }
  }, [isCorrectChain]);

  // Use ref for fetchBalance in interval to prevent re-creation
  const fetchBalanceRef = useRef(fetchBalance);
  useEffect(() => {
    fetchBalanceRef.current = fetchBalance;
  }, [fetchBalance]);

  useEffect(() => {
    if (isConnected && isCorrectChain) {
      fetchBalance();
      const interval = setInterval(() => {
        fetchBalanceRef.current();
      }, 10000);
      return () => clearInterval(interval);
    } else {
      setHermesBalance(0);
      setUsdtBalance(0);
    }
  }, [isConnected, isCorrectChain, fetchBalance]);

  const handleRefresh = () => {
    fetchBalance();
  };

  // Wrong chain state
  if (isConnected && !isCorrectChain) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-6 text-center"
        style={{ 
          backgroundColor: FUND_THEME.surface,
          border: `1px solid #EF444440`
        }}
      >
        <motion.div 
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#EF444420' }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#EF4444">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </motion.div>
        
        <h3 className="text-xl font-bold mb-2" style={{ color: '#EF4444' }}>
          {language === 'tr' ? 'Yanlış Ağ!' : 'Wrong Network!'}
        </h3>
        
        <p className="text-sm mb-4" style={{ color: FUND_THEME.textMuted }}>
          {language === 'tr' 
            ? 'Lütfen BSC Mainnet ağına geçin'
            : 'Please switch to BSC Mainnet'}
        </p>
        
        <motion.button
          onClick={async () => {
            try {
              await window.ethereum?.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
            } catch {}
          }}
          className="px-6 py-3 rounded-lg font-semibold"
          style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {language === 'tr' ? 'Ağı Değiştir' : 'Switch Network'}
        </motion.button>
      </motion.div>
    );
  }

  // Loading state
  if (isConnected && isLoading && hermesBalance === 0) {
    return (
      <div 
        className="rounded-xl p-6 animate-pulse"
        style={{ backgroundColor: FUND_THEME.surface }}
      >
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-4" />
        <div className="h-8 bg-gray-700 rounded w-1/2" />
      </div>
    );
  }

  // Connected - Show balance check
  if (isConnected && isCorrectChain) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-6"
        style={{ 
          backgroundColor: FUND_THEME.surface,
          border: `1px solid ${isEligible ? '#22C55E' : '#EF4444'}40`
        }}
      >
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: FUND_THEME.text }}>
            {language === 'tr' ? '🔐 HERMES Bakiyesi' : '🔐 HERMES Balance'}
          </h3>
          
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg transition-all hover:bg-white/10 disabled:opacity-50"
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <svg 
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke={FUND_THEME.textMuted}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </motion.button>
            
            <motion.div 
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ 
                backgroundColor: isEligible ? '#22C55E20' : '#EF444420',
                color: isEligible ? '#22C55E' : '#EF4444'
              }}
              animate={isEligible ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {isEligible 
                ? (language === 'tr' ? '✓ Hazır' : '✓ Ready')
                : (language === 'tr' ? '✗ Yetersiz' : '✗ Insufficient')}
            </motion.div>
          </div>
        </div>
        
        {/* Balance Info */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span style={{ color: FUND_THEME.textMuted }}>
              {language === 'tr' ? 'Mevcut Bakiye' : 'Current Balance'}
            </span>
            <span 
              className="font-mono font-bold"
              style={{ color: isEligible ? '#22C55E' : FUND_THEME.text }}
            >
              {formatHermes(hermesBalance)} HERMES
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span style={{ color: FUND_THEME.textMuted }}>
              {language === 'tr' ? 'Gerekli Stake' : 'Required Stake'}
            </span>
            <span className="font-mono" style={{ color: FUND_THEME.accent }}>
              {formatHermes(FUND_CONSTANTS.HERMES_STAKE_REQUIRED)} HERMES
            </span>
          </div>
          
          {!isEligible && (
            <motion.div 
              className="mt-4 p-3 rounded-lg"
              style={{ backgroundColor: '#EF444410' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2 text-sm">
                <span style={{ color: '#EF4444' }}>
                  ⚠️ {language === 'tr' 
                    ? `${formatHermes(deficit)} HERMES daha gerekli`
                    : `Need ${formatHermes(deficit)} more HERMES`}
                </span>
              </div>
            </motion.div>
          )}
          
          {isEligible && (
            <motion.div 
              className="mt-4 p-3 rounded-lg"
              style={{ backgroundColor: '#22C55E10' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2 text-sm">
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ✨
                </motion.span>
                <span style={{ color: '#22C55E' }}>
                  {language === 'tr' 
                    ? 'Fona katılmaya hazırsınız!'
                    : 'You are ready to join the fund!'}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  // Not connected - Don't show anything if showConnectPrompt is false
  if (!showConnectPrompt) {
    return null;
  }

  return null;
}
