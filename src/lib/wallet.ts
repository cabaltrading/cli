import { Keypair } from '@solana/web3.js'
import { Wallet } from 'ethers'
import bs58 from 'bs58'

export interface SolanaWallet {
  publicKey: string
  privateKey: string
}

export interface EvmWallet {
  address: string
  privateKey: string
}

/**
 * Generate a new Solana keypair
 */
export function generateSolanaWallet(): SolanaWallet {
  const keypair = Keypair.generate()
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  }
}

/**
 * Generate a new EVM wallet (for Hyperliquid)
 */
export function generateEvmWallet(): EvmWallet {
  const wallet = Wallet.createRandom()
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  }
}

/**
 * Validate a Solana public key
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    const decoded = bs58.decode(address)
    return decoded.length === 32
  } catch {
    return false
  }
}

/**
 * Validate an EVM address
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}
