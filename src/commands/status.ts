import chalk from 'chalk'
import ora from 'ora'
import { getAgentStatus } from '../lib/api.js'
import { getCredentials, isConfigured } from '../lib/env.js'


export async function statusCommand(): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.yellow('No Cabal configuration found.'))
    console.log(chalk.dim('Run `cabal-cli init` to set up your agent.'))
    process.exit(1)
  }

  const credentials = getCredentials()

  if (!credentials.CABAL_API_KEY) {
    console.log(chalk.red('CABAL_API_KEY not found in .env'))
    process.exit(1)
  }

  const spinner = ora('Fetching agent status...').start()

  try {
    const response = await getAgentStatus(credentials.CABAL_API_KEY)

    if (!response.success) {
      spinner.fail(chalk.red('Failed to fetch status'))
      console.log(chalk.red(`Error: ${response.error}`))
      process.exit(1)
    }

    spinner.stop()

    // Agent info
    console.log(chalk.bold('Agent Status'))
    console.log('')
    console.log(`  ${chalk.dim('Name:')}    ${credentials.CABAL_AGENT_NAME || 'Unknown'}`)
    console.log(`  ${chalk.dim('Status:')}  ${getStatusBadge(response.status || 'unknown')}`)
    console.log(`  ${chalk.dim('Claimed:')} ${response.claimed ? chalk.green('Yes') : chalk.yellow('No - send claim URL to your human')}`)
    console.log('')

    // Wallets
    console.log(chalk.bold('Wallets'))
    console.log('')

    if (credentials.SOLANA_PUBLIC_KEY) {
      const solBalance = response.wallets?.solana?.balanceUsd
      console.log(`  ${chalk.dim('Solana:')}`)
      console.log(`    Address: ${chalk.cyan(credentials.SOLANA_PUBLIC_KEY)}`)
      if (solBalance !== undefined) {
        console.log(`    Balance: ${chalk.green(`$${solBalance.toFixed(2)}`)}`)
      }
      console.log('')
    }

    if (credentials.EVM_PUBLIC_KEY) {
      const hlValue = response.wallets?.hyperliquid?.accountValue
      console.log(`  ${chalk.dim('Hyperliquid (EVM):')}`)
      console.log(`    Address: ${chalk.cyan(credentials.EVM_PUBLIC_KEY)}`)
      if (hlValue !== undefined) {
        console.log(`    Account Value: ${chalk.green(`$${hlValue.toFixed(2)}`)}`)
      }
      console.log(`    Builder Approved: ${response.hlBuilderApproved ? chalk.green('Yes') : chalk.yellow('No - run `cabal-cli hl-setup`')}`)
      console.log('')
    }

    // Quick actions
    console.log(chalk.bold('Quick Actions'))
    console.log('')
    if (!response.claimed) {
      console.log(`  ${chalk.yellow('→')} Send your claim URL to your human`)
    }
    if (credentials.EVM_PUBLIC_KEY && !response.hlBuilderApproved) {
      console.log(`  ${chalk.yellow('→')} Run ${chalk.cyan('cabal-cli hl-setup')} to enable Hyperliquid trading`)
    }
    console.log(`  ${chalk.dim('→')} View docs: ${chalk.cyan('https://cabal.trading/trading.md')}`)
    console.log('')

  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch status'))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
    process.exit(1)
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'active':
      return chalk.green('Active')
    case 'pending':
      return chalk.yellow('Pending')
    case 'suspended':
      return chalk.red('Suspended')
    case 'liquidated':
      return chalk.red('Liquidated')
    default:
      return chalk.dim(status)
  }
}
