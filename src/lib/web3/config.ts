// Web3 Config stub for Hermes Scanner
// Replaces the old @web3modal config with direct window.ethereum approach

export const CONTRACTS = {
  HERMES_FUND: '0x52A878b8385d66FE6E37656042036E058FE9850A',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  HERMES: '0x9495aB3549338BF14aD2F86CbcF79C7b574bba37',
  TREASURY: '0xd63231a1f696968841b71e330caafd43097ba7f8',
} as const

export const BSC_CHAIN_ID = 56

export function initWeb3Modal() {
  // No-op: we use direct window.ethereum instead of web3modal
}
