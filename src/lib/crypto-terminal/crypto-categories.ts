// Static category tags for top crypto coins
// Maps CoinGecko coin IDs to primary category tags

export type CryptoCategory = 'L1' | 'L2' | 'DeFi' | 'AI' | 'Meme' | 'GameFi' | 'Stablecoin' | 'DEX' | 'Oracle' | 'Privacy' | 'RWA' | 'NFT' | 'Infra' | 'CEX' | 'Storage' | 'Social' | 'BRC20' | 'LSD'

const CATEGORY_MAP: Record<string, CryptoCategory[]> = {
  bitcoin: ['L1'],
  ethereum: ['L1', 'DeFi'],
  tether: ['Stablecoin'],
  binancecoin: ['L1', 'CEX'],
  solana: ['L1'],
  'usd-coin': ['Stablecoin'],
  ripple: ['L1', 'Infra'],
  cardano: ['L1'],
  dogecoin: ['Meme', 'L1'],
  tron: ['L1', 'DeFi'],
  polkadot: ['L1', 'Infra'],
  'avalanche-2': ['L1', 'DeFi'],
  chainlink: ['Oracle', 'DeFi'],
  'shiba-inu': ['Meme'],
  'matic-network': ['L2'],
  litecoin: ['L1'],
  dai: ['Stablecoin', 'DeFi'],
  uniswap: ['DEX', 'DeFi'],
  'internet-computer': ['L1', 'Infra'],
  'bitcoin-cash': ['L1'],
  cosmos: ['L1', 'Infra'],
  stellar: ['L1'],
  'ethereum-classic': ['L1'],
  aptos: ['L1'],
  'near': ['L1', 'AI'],
  optimism: ['L2'],
  'arbitrum': ['L2', 'DeFi'],
  filecoin: ['Storage', 'Infra'],
  'the-graph': ['Infra', 'DeFi'],
  monero: ['Privacy', 'L1'],
  vechain: ['L1', 'Infra'],
  'hedera-hashgraph': ['L1'],
  'lido-dao': ['LSD', 'DeFi'],
  maker: ['DeFi'],
  aave: ['DeFi'],
  'the-sandbox': ['GameFi', 'NFT'],
  'axie-infinity': ['GameFi', 'NFT'],
  decentraland: ['GameFi', 'NFT'],
  'immutable-x': ['L2', 'NFT', 'GameFi'],
  fantom: ['L1', 'DeFi'],
  algorand: ['L1'],
  'injective-protocol': ['DeFi', 'L1'],
  'theta-token': ['Infra'],
  'render-token': ['AI', 'Infra'],
  'fetch-ai': ['AI'],
  'ocean-protocol': ['AI', 'DeFi'],
  'singularitynet': ['AI'],
  'bittensor': ['AI'],
  'worldcoin-wld': ['AI'],
  ondo: ['RWA', 'DeFi'],
  'mantle': ['L2'],
  pepe: ['Meme'],
  'floki': ['Meme', 'GameFi'],
  bonk: ['Meme'],
  'based-brett': ['Meme'],
  'dogwifcoin': ['Meme'],
  'starknet': ['L2'],
  'zksync': ['L2'],
  'base': ['L2'],
  'sui': ['L1'],
  'sei-network': ['L1'],
  'celestia': ['L1', 'Infra'],
  'eigenlayer': ['LSD', 'Infra'],
  'pendle': ['DeFi', 'LSD'],
  'ethena': ['DeFi', 'Stablecoin'],
  'jupiter': ['DEX', 'DeFi'],
  'raydium': ['DEX', 'DeFi'],
  'orca': ['DEX', 'DeFi'],
  'pancakeswap-token': ['DEX', 'DeFi'],
  'curve-dao-token': ['DEX', 'DeFi'],
  'sushiswap': ['DEX', 'DeFi'],
  '1inch': ['DEX', 'DeFi'],
  'compound-governance-token': ['DeFi'],
  'synthetix-network-token': ['DeFi'],
  'yearn-finance': ['DeFi'],
  'convex-finance': ['DeFi', 'LSD'],
  'rocket-pool': ['LSD', 'DeFi'],
  'zcash': ['Privacy'],
  'dash': ['Privacy'],
  'decred': ['L1'],
  'arweave': ['Storage', 'Infra'],
  'akash-network': ['AI', 'Infra'],
  'kaspa': ['L1'],
  'ton': ['L1', 'Social'],
  'elrond-erd-2': ['L1'],
  'polygon-ecosystem-token': ['L2'],
  'blur': ['NFT'],
  'ens': ['Infra'],
  'gala': ['GameFi'],
  'illuvium': ['GameFi', 'NFT'],
  'stepn': ['GameFi', 'Social'],
  'lens-protocol': ['Social'],
  'friend-tech': ['Social'],
  'wormhole': ['Infra'],
  'layerzero': ['Infra'],
  'pyth-network': ['Oracle'],
  'band-protocol': ['Oracle'],
  'api3': ['Oracle'],
  'dia-data': ['Oracle'],
  'helium': ['Infra'],
  'io-net': ['AI', 'Infra'],
  'grass': ['AI'],
  'virtual-protocol': ['AI'],
  'artificial-superintelligence-alliance': ['AI'],
  'tao-network': ['AI'],
  'mantra-dao': ['RWA'],
  'polymesh': ['RWA'],
  'centrifuge': ['RWA', 'DeFi'],
  'maple': ['RWA', 'DeFi'],
}

const CATEGORY_STYLE: Record<CryptoCategory, { bg: string; text: string }> = {
  L1: { bg: 'bg-info-400/15', text: 'text-info-400' },
  L2: { bg: 'bg-indigo-500/15', text: 'text-indigo-300' },
  DeFi: { bg: 'bg-purple-500/15', text: 'text-purple-300' },
  AI: { bg: 'bg-cyan-500/15', text: 'text-cyan-300' },
  Meme: { bg: 'bg-pink-500/15', text: 'text-pink-300' },
  GameFi: { bg: 'bg-yellow-500/15', text: 'text-yellow-300' },
  Stablecoin: { bg: 'bg-success-400/15', text: 'text-success-300' },
  DEX: { bg: 'bg-info-400/15', text: 'text-info-400' },
  Oracle: { bg: 'bg-warning-400/15', text: 'text-orange-300' },
  Privacy: { bg: 'bg-gray-500/15', text: 'text-gray-300' },
  RWA: { bg: 'bg-gold-500/15', text: 'text-gold-300' },
  NFT: { bg: 'bg-rose-500/15', text: 'text-rose-300' },
  Infra: { bg: 'bg-teal-500/15', text: 'text-teal-300' },
  CEX: { bg: 'bg-danger-400/15', text: 'text-danger-300' },
  Storage: { bg: 'bg-lime-500/15', text: 'text-lime-300' },
  Social: { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300' },
  BRC20: { bg: 'bg-orange-600/15', text: 'text-orange-200' },
  LSD: { bg: 'bg-sky-500/15', text: 'text-sky-300' },
}

export function getCoinCategories(coinId: string): CryptoCategory[] {
  return CATEGORY_MAP[coinId] || []
}

export function getCategoryStyle(cat: CryptoCategory): { bg: string; text: string } {
  return CATEGORY_STYLE[cat]
}

export function inferCategoryFromName(name: string, symbol: string): CryptoCategory[] {
  const n = name.toLowerCase()
  const s = symbol.toLowerCase()
  const tags: CryptoCategory[] = []
  if (n.includes('ai') || n.includes('neural') || n.includes('gpt') || n.includes('intelligence')) tags.push('AI')
  if (n.includes('swap') || n.includes('dex') || n.includes('exchange')) tags.push('DEX')
  if (n.includes('dao') && !tags.includes('DeFi')) tags.push('DeFi')
  if (n.includes('inu') || n.includes('doge') || n.includes('pepe') || n.includes('cat') || n.includes('frog') || s.includes('doge') || s.includes('shib')) tags.push('Meme')
  if (n.includes('game') || n.includes('play') || n.includes('quest')) tags.push('GameFi')
  if (n.includes('usd') || n.includes('stable')) tags.push('Stablecoin')
  return tags
}
