'use client';

import { initWeb3Modal } from '@/lib/web3/config';

interface Web3ProviderProps {
  children: React.ReactNode;
}

// Web3Modal'ı module seviyesinde HEMEN initialize et (client-side)
// Bu sayede hook'lar kullanılmadan ÖNCE modal hazır olur
if (typeof window !== 'undefined') {
  initWeb3Modal();
}

export default function Web3Provider({ children }: Web3ProviderProps) {
  // Web3Modal zaten module seviyesinde initialize edildi
  // Sadece children'ı render et
  return <>{children}</>;
}

