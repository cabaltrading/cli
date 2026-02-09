import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { privateKeyToAccount } from 'viem/accounts'
import { getCredentials, isConfigured } from '../lib/env.js'
import { confirmHLApproval } from '../lib/api.js'
import { getBuilderInfo } from '@cabal/hyperliquid'

// Testnet mode: set HL_TESTNET=true to use testnet
const IS_TESTNET = process.env.HL_TESTNET === 'true'

const HL_API_URL = IS_TESTNET
  ? 'https://api.hyperliquid-testnet.xyz'
  : 'https://api.hyperliquid.xyz'

const HL_CHAIN_NAME = IS_TESTNET ? 'Testnet' : 'Mainnet'

// Chain IDs for EIP-712 signing and API payload
// Mainnet: 42161 (Arbitrum One), Testnet: 421614 (Arbitrum Sepolia)
const SIGNATURE_CHAIN_ID = IS_TESTNET ? 421614 : 42161
const SIGNATURE_CHAIN_ID_HEX = IS_TESTNET ? '0x66eee' : '0xa4b1'

// Hyperliquid EIP-712 domain
const HL_DOMAIN = {
  name: 'HyperliquidSignTransaction',
  version: '1',
  chainId: SIGNATURE_CHAIN_ID,
  verifyingContract: '0x0000000000000000000000000000000000000000' as const,
}

// Type definitions for approveBuilderFee action
// Primary type: "HyperliquidTransaction:ApproveBuilderFee"
const APPROVE_BUILDER_FEE_TYPES = {
  'HyperliquidTransaction:ApproveBuilderFee': [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'maxFeeRate', type: 'string' },
    { name: 'builder', type: 'address' },
    { name: 'nonce', type: 'uint64' },
  ],
} as const

export async function hlSetupCommand(): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.yellow('No Cabal configuration found.'))
    console.log(chalk.dim('Run `cabal-cli init` to set up your agent.'))
    process.exit(1)
  }

  const credentials = getCredentials()

  if (!credentials.EVM_PRIVATE_KEY || !credentials.EVM_PUBLIC_KEY) {
    console.log(chalk.yellow('No EVM wallet found in .env'))
    console.log(chalk.dim('Run `cabal-cli init` to generate an EVM wallet for Hyperliquid.'))
    process.exit(1)
  }

  if (!credentials.CABAL_API_KEY) {
    console.log(chalk.red('CABAL_API_KEY not found in .env'))
    process.exit(1)
  }

  console.log(chalk.bold('Hyperliquid Builder Fee Setup'))
  if (IS_TESTNET) {
    console.log(chalk.yellow('⚠️  TESTNET MODE'))
  }
  console.log('')
  console.log(chalk.dim('This will approve Cabal to collect builder fees on your trades.'))
  console.log(chalk.dim('Fee: 5 bps (0.05%) on perps, 50 bps (0.5%) on spot sells.'))
  console.log('')

  // Get builder info
  const spinner = ora('Fetching builder info...').start()

  const builderInfo = getBuilderInfo()
  const builderAddress = builderInfo.builder_address
  const feeBps = builderInfo.fee_bps.perps
  spinner.succeed(`Builder address: ${chalk.cyan(builderAddress)}`)

  // Check HL account balance
  spinner.start('Checking Hyperliquid account...')

  try {
    const response = await fetch(`${HL_API_URL}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: credentials.EVM_PUBLIC_KEY,
      }),
    })

    const state = (await response.json()) as {
      crossMarginSummary?: { accountValue: string }
    }
    const accountValue = parseFloat(state.crossMarginSummary?.accountValue || '0')

    if (accountValue < 1) {
      spinner.warn(chalk.yellow(`Account value: $${accountValue.toFixed(2)}`))
      console.log('')
      console.log(chalk.yellow('⚠️  Your Hyperliquid account has low or no balance.'))
      console.log(chalk.dim('   You need USDC on Hyperliquid to trade.'))
      console.log('')
      const bridgeUrl = IS_TESTNET
        ? 'https://app.hyperliquid-testnet.xyz'
        : 'https://app.hyperliquid.xyz/bridge'
      console.log(chalk.dim('   Bridge USDC via: ') + chalk.cyan(bridgeUrl))
      console.log('')

      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Continue with builder approval anyway?',
          default: false,
        },
      ])

      if (!proceed) {
        console.log(chalk.dim('Aborted. Fund your account first, then run this again.'))
        process.exit(0)
      }
    } else {
      spinner.succeed(`Account value: ${chalk.green(`$${accountValue.toFixed(2)}`)}`)
    }
  } catch {
    spinner.warn('Could not check account balance (continuing anyway)')
  }

  // Confirm
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Approve Cabal (${builderAddress.slice(0, 10)}...) for ${feeBps} bps builder fee?`,
      default: true,
    },
  ])

  if (!confirm) {
    console.log(chalk.dim('Aborted.'))
    process.exit(0)
  }

  // Sign and submit the approval using EIP-712
  spinner.start('Signing approval transaction (EIP-712)...')

  try {
    // Ensure private key has 0x prefix
    const privateKey = credentials.EVM_PRIVATE_KEY.startsWith('0x')
      ? (credentials.EVM_PRIVATE_KEY as `0x${string}`)
      : (`0x${credentials.EVM_PRIVATE_KEY}` as `0x${string}`)

    const account = privateKeyToAccount(privateKey)
    const nonce = Date.now()

    // Convert bps to percentage string (50 bps = "0.5%")
    const maxFeeRatePercent = `${feeBps / 100}%`

    // Sign using EIP-712 typed data
    const signature = await account.signTypedData({
      domain: HL_DOMAIN,
      types: APPROVE_BUILDER_FEE_TYPES,
      primaryType: 'HyperliquidTransaction:ApproveBuilderFee',
      message: {
        hyperliquidChain: HL_CHAIN_NAME,
        maxFeeRate: maxFeeRatePercent,
        builder: builderAddress as `0x${string}`,
        nonce: BigInt(nonce),
      },
    })

    // Build the action payload (includes signatureChainId for API)
    const action = {
      type: 'approveBuilderFee',
      hyperliquidChain: HL_CHAIN_NAME,
      signatureChainId: SIGNATURE_CHAIN_ID_HEX,
      maxFeeRate: maxFeeRatePercent,
      builder: builderAddress,
      nonce,
    }

    spinner.text = 'Submitting to Hyperliquid...'

    // Parse signature into r, s, v
    const r = signature.slice(0, 66)
    const s = '0x' + signature.slice(66, 130)
    const v = parseInt(signature.slice(130, 132), 16)

    // Submit to Hyperliquid exchange API
    const response = await fetch(`${HL_API_URL}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        nonce,
        signature: { r, s, v },
        vaultAddress: null,
      }),
    })

    const result = (await response.json()) as {
      status?: string
      response?: { type: string; data?: unknown }
      error?: string
    }

    // Check for errors
    if (result.status === 'err' || result.error) {
      throw new Error(result.error || JSON.stringify(result))
    }

    spinner.succeed('Approval submitted to Hyperliquid!')
  } catch (error) {
    spinner.fail('Failed to submit approval')
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
    console.log('')
    console.log(chalk.yellow('Troubleshooting:'))
    console.log(chalk.dim('  1. Make sure you have some USDC on Hyperliquid'))
    console.log(chalk.dim('  2. Try approving manually via the Hyperliquid UI'))
    console.log(chalk.dim('  3. After manual approval, run this command again to confirm with Cabal'))
    process.exit(1)
  }

  // Confirm with Cabal
  spinner.start('Confirming with Cabal...')

  try {
    const response = await confirmHLApproval(credentials.CABAL_API_KEY)

    if (!response.success) {
      spinner.fail('Failed to confirm with Cabal')
      console.log(chalk.red(`Error: ${response.error}`))
      console.log('')
      console.log(chalk.dim('The approval may still be pending on Hyperliquid.'))
      console.log(chalk.dim('Wait a moment and try again: `cabal-cli hl-setup`'))
      process.exit(1)
    }

    spinner.succeed('Builder fee confirmed with Cabal!')

    console.log('')
    console.log(chalk.green.bold('✓ Hyperliquid setup complete!'))
    console.log('')
    console.log(chalk.dim('You can now trade on Hyperliquid through Cabal.'))
    console.log(chalk.dim('Docs: ') + chalk.cyan('https://cabal.trading/trading.md'))
    console.log('')
  } catch (error) {
    spinner.fail('Failed to confirm with Cabal')
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
    process.exit(1)
  }
}
