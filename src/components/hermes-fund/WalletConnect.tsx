'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';
import { FUND_THEME, FUND_CONSTANTS } from '@/types/hermesFund';
import { CONTRACTS, BSC_CHAIN_ID } from '@/lib/web3/config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { ethereum?: any } }

// Minimal ERC20 ABI for balance check
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

interface WalletConnectProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
  connectedAddress: string | null;
}

export default function WalletConnect({ 
  onConnect, 
  onDisconnect, 
  connectedAddress 
}: WalletConnectProps) {
  const { language } = useLanguage();
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hermesBalance, setHermesBalance] = useState<string>('0');
  const [usdtBalance, setUsdtBalance] = useState<string>('0');

  const isCorrectChain = useMemo(() => chainId === BSC_CHAIN_ID, [chainId]);

  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onConnect, onDisconnect]);

  // Check if already connected
  useEffect(() => {
    const checkConnection = async () => {
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
    checkConnection();
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        setIsConnected(false);
        onDisconnectRef.current();
      } else {
        setAddress(accounts[0]);
        setIsConnected(true);
      }
    };
    const onChainChanged = (chainIdHex: string) => {
      setChainId(parseInt(chainIdHex, 16));
    };
    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);
    return () => {
      window.ethereum?.removeListener?.('accountsChanged', onAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', onChainChanged);
    };
  }, []);

  // Notify parent when connection changes
  useEffect(() => {
    if (isConnected && address) {
      onConnectRef.current(address);
    } else if (!isConnected && connectedAddress) {
      onDisconnectRef.current();
    }
  }, [isConnected, address, connectedAddress]);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!window.ethereum || !address || !isCorrectChain) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const hermesContract = new Contract(CONTRACTS.HERMES_FUND.replace(CONTRACTS.HERMES_FUND, CONTRACTS.HERMES_FUND), ERC20_ABI, provider);
      const hermesC = new Contract('0x9495aB3549338BF14aD2F86CbcF79C7b574bba37', ERC20_ABI, provider);
      const hermesBalanceRaw = await hermesC.balanceOf(address);
      const hermesDecimals = await hermesC.decimals();
      setHermesBalance(formatUnits(hermesBalanceRaw, hermesDecimals));

      const usdtContract = new Contract(CONTRACTS.USDT, ERC20_ABI, provider);
      const usdtBalanceRaw = await usdtContract.balanceOf(address);
      const usdtDecimals = await usdtContract.decimals();
      setUsdtBalance(formatUnits(usdtBalanceRaw, usdtDecimals));
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  }, [address, isCorrectChain]);

  useEffect(() => {
    if (isConnected && isCorrectChain) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 30000);
      return () => clearInterval(interval);
    } else {
      setHermesBalance('0');
      setUsdtBalance('0');
    }
  }, [isConnected, isCorrectChain, fetchBalances]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatBalance = (balance: string, decimals: number = 2) => {
    const num = parseFloat(balance);
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(decimals)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  };

  const handleConnect = async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        const chain = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chain, 16));
      }
    } catch (error) {
      console.error('Connect error:', error);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    setIsConnected(false);
    onDisconnect();
    setShowDropdown(false);
  };

  const handleSwitchChain = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }], // BSC Mainnet
      });
    } catch (error: any) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x38',
            chainName: 'BNB Smart Chain',
            rpcUrls: ['https://bsc-dataseed.binance.org/'],
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            blockExplorerUrls: ['https://bscscan.com/']
          }]
        });
      }
    }
  };

  // Not connected
  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all duration-300 hover:scale-105"
        style={{ 
          background: `linear-gradient(135deg, ${FUND_THEME.primary}, ${FUND_THEME.secondary})`,
          color: FUND_THEME.text,
          boxShadow: `0 4px 20px ${FUND_THEME.primary}30`
        }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        {language === 'tr' ? 'Cüzdanı Bağla' : 'Connect Wallet'}
      </button>
    );
  }

  // Connected
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300"
        style={{ 
          backgroundColor: FUND_THEME.surface,
          border: `1px solid ${isCorrectChain ? '#22C55E' : '#EF4444'}40`
        }}
      >
        <div 
          className="w-2.5 h-2.5 rounded-full animate-pulse"
          style={{ backgroundColor: isCorrectChain ? '#22C55E' : '#EF4444' }}
        />
        <span className="font-mono text-sm" style={{ color: FUND_THEME.text }}>
          {formatAddress(address || '')}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke={FUND_THEME.textMuted}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 w-72 rounded-lg overflow-hidden z-50"
            style={{ 
              backgroundColor: FUND_THEME.surface,
              border: `1px solid ${FUND_THEME.primary}20`,
              boxShadow: `0 10px 40px rgba(0,0,0,0.3)`
            }}
          >
            {/* Chain Status */}
            <div className="p-3" style={{ borderBottom: `1px solid ${FUND_THEME.primary}20` }}>
              <div className="flex items-center justify-between">
                <span style={{ color: FUND_THEME.textMuted }}>{language === 'tr' ? 'Ağ' : 'Network'}</span>
                <span style={{ color: isCorrectChain ? '#22C55E' : '#EF4444' }}>
                  {isCorrectChain ? 'BSC ✓' : (language === 'tr' ? 'Yanlış Ağ' : 'Wrong Network')}
                </span>
              </div>
            </div>

            {/* Balances */}
            {isCorrectChain && (
              <div className="p-3 space-y-2" style={{ borderBottom: `1px solid ${FUND_THEME.primary}20` }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: FUND_THEME.textMuted }}>HERMES</span>
                  <span 
                    className="font-mono"
                    style={{ color: parseFloat(hermesBalance) >= FUND_CONSTANTS.HERMES_STAKE_REQUIRED ? '#22C55E' : '#EF4444' }}
                  >
                    {formatBalance(hermesBalance)} HERMES
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: FUND_THEME.textMuted }}>USDT</span>
                  <span className="font-mono" style={{ color: FUND_THEME.primary }}>
                    {formatBalance(usdtBalance)} USDT
                  </span>
                </div>
              </div>
            )}

            {/* Switch Network */}
            {!isCorrectChain && (
              <button
                onClick={handleSwitchChain}
                className="w-full p-3 text-sm text-left flex items-center gap-2 hover:bg-white/5 transition-colors"
                style={{ color: FUND_THEME.accent }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {language === 'tr' ? 'BSC Ağına Geç' : 'Switch to BSC'}
              </button>
            )}

            {/* BscScan Link */}
            <a
              href={`https://bscscan.com/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full p-3 text-sm text-left flex items-center gap-2 hover:bg-white/5 transition-colors block"
              style={{ color: FUND_THEME.textMuted }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              BscScan
            </a>

            {/* Disconnect */}
            <button
              onClick={handleDisconnect}
              className="w-full p-3 text-sm text-left flex items-center gap-2 hover:bg-white/5 transition-colors"
              style={{ color: '#EF4444', borderTop: `1px solid ${FUND_THEME.primary}20` }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {language === 'tr' ? 'Bağlantıyı Kes' : 'Disconnect'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
      )}
    </div>
  );
}
