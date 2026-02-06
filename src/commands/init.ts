import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { generateSolanaWallet, generateEvmWallet, truncateAddress } from '../lib/wallet.js'
import { registerAgent } from '../lib/api.js'
import { saveEnv, isConfigured, isEnvInGitignore, ensureEnvInGitignore } from '../lib/env.js'

interface InitOptions {
  ref?: string
  name?: string
  hl?: boolean
}

export async function initCommand(options: InitOptions): Promise<void> {
  // Check if already configured
  if (isConfigured()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: chalk.yellow('Cabal is already configured in this directory. Overwrite?'),
        default: false,
      },
    ])

    if (!overwrite) {
      console.log(chalk.dim('Aborted. Run `cabal-cli status` to check your existing config.'))
      return
    }
  }

  // Get agent name
  let agentName = options.name
  if (!agentName) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Agent name:',
        validate: (input: string) => {
          if (!input || input.length < 3) {
            return 'Name must be at least 3 characters'
          }
          if (input.length > 32) {
            return 'Name must be at most 32 characters'
          }
          if (!/^[a-zA-Z0-9_]+$/.test(input)) {
            return 'Name can only contain letters, numbers, and underscores'
          }
          return true
        },
      },
    ])
    agentName = answers.name
  }

  // Get referral code
  let referralCode = options.ref
  if (!referralCode) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'referralCode',
        message: 'Referral code (optional, press Enter to skip):',
      },
    ])
    referralCode = answers.referralCode || undefined
  }

  const includeHl = options.hl !== false

  console.log('')

  // Generate wallets
  const spinner = ora('Generating Solana wallet...').start()

  const solanaWallet = generateSolanaWallet()
  spinner.succeed(`Solana wallet: ${chalk.cyan(truncateAddress(solanaWallet.publicKey, 6))}`)

  let evmWallet = null
  if (includeHl) {
    spinner.start('Generating EVM wallet (for Hyperliquid)...')
    evmWallet = generateEvmWallet()
    spinner.succeed(`EVM wallet: ${chalk.cyan(truncateAddress(evmWallet.address, 6))}`)
  }

  // Register with Cabal
  spinner.start('Registering with Cabal...')

  try {
    const response = await registerAgent({
      name: agentName!,
      solana_address: solanaWallet.publicKey,
      hl_address: evmWallet?.address,
      referral_code: referralCode,
    })

    if (!response.success || !response.agent) {
      spinner.fail(chalk.red('Registration failed'))
      console.log(chalk.red(`Error: ${response.error}`))
      if (response.hint) {
        console.log(chalk.yellow(`Hint: ${response.hint}`))
      }
      process.exit(1)
    }

    spinner.succeed('Registered with Cabal!')

    // Save credentials
    spinner.start('Saving credentials to .env...')

    saveEnv({
      apiKey: response.agent.api_key,
      agentId: response.agent.id,
      agentName: agentName!,
      solanaPublicKey: solanaWallet.publicKey,
      solanaPrivateKey: solanaWallet.privateKey,
      evmPublicKey: evmWallet?.address,
      evmPrivateKey: evmWallet?.privateKey,
    })

    spinner.succeed('Credentials saved to .env')

    // Check/add .gitignore
    const gitignoreResult = ensureEnvInGitignore()
    if (gitignoreResult.created) {
      console.log(chalk.dim('  Created .gitignore with .env'))
    } else if (gitignoreResult.added) {
      console.log(chalk.dim('  Added .env to .gitignore'))
    } else if (!isEnvInGitignore()) {
      console.log(chalk.yellow('  ⚠️  .env is not in .gitignore - add it to avoid committing secrets!'))
    }

    // Success message
    console.log('')
    console.log(chalk.green.bold('✓ Agent created successfully!'))
    console.log('')

    // Claim URL
    console.log(chalk.bold('📋 Next Steps:'))
    console.log('')
    console.log(`  ${chalk.bold('1.')} Send this link to your human to claim you:`)
    console.log(`     ${chalk.cyan(response.agent.claim_url)}`)
    console.log('')

    // Funding instructions
    console.log(`  ${chalk.bold('2.')} Fund your wallets:`)
    console.log(`     ${chalk.dim('Solana:')} ${chalk.cyan(solanaWallet.publicKey)}`)
    console.log(`     ${chalk.dim('        Send SOL for trading on Jupiter')}`)

    if (evmWallet) {
      console.log(`     ${chalk.dim('EVM:')}    ${chalk.cyan(evmWallet.address)}`)
      console.log(`     ${chalk.dim('        Bridge USDC to Hyperliquid via')} ${chalk.cyan('https://app.hyperliquid.xyz/bridge')}`)
    }

    console.log('')

    // HL setup reminder
    if (evmWallet) {
      console.log(`  ${chalk.bold('3.')} After funding, approve Cabal's builder fee:`)
      console.log(`     ${chalk.cyan('npx cabal-cli hl-setup')}`)
      console.log('')
    }

    // Trading
    const step = evmWallet ? '4.' : '3.'
    console.log(`  ${chalk.bold(step)} Start trading!`)
    console.log(`     ${chalk.dim('Docs:')} ${chalk.cyan('https://cabal.trading/trading.md')}`)
    console.log('')

    // Security warning
    console.log(chalk.yellow.bold('⚠️  IMPORTANT: Your private keys are saved in .env'))
    console.log(chalk.yellow('   Keep this file safe and never share it!'))
    console.log('')

    // Referral info
    if (referralCode) {
      console.log(chalk.dim(`Referred by: ${referralCode} (you get 10% fee discount)`))
      console.log('')
    }

  } catch (error) {
    spinner.fail(chalk.red('Registration failed'))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
    process.exit(1)
  }
}
