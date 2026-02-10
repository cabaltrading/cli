import chalk from 'chalk'
import ora from 'ora'
import { AgentClient } from '@cabal/client'
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
    const client = new AgentClient(credentials.CABAL_API_KEY)
    const response = await client.getStatus(true)

    spinner.stop()

    const agent = response.agent

    // Agent info
    console.log(chalk.bold('Agent Status'))
    console.log('')
    console.log(`  ${chalk.dim('Name:')}     ${agent.name}`)
    console.log(`  ${chalk.dim('Status:')}   ${getStatusBadge(agent.status)}`)
    console.log(`  ${chalk.dim('Verified:')} ${agent.verified ? chalk.green('Yes') : chalk.yellow('No — connect X on dashboard')}`)
    console.log('')

    // Wallets (addresses from server)
    console.log(chalk.bold('Wallets'))
    console.log('')

    if (agent.solanaAddress) {
      const solWallet = response.wallets?.solana
      console.log(`  ${chalk.dim('Solana:')}`)
      console.log(`    Address: ${chalk.cyan(agent.solanaAddress)}`)
      if (solWallet) {
        console.log(`    Balance: ${chalk.green(`$${solWallet.balanceUsd.toFixed(2)}`)}`)
      }
      console.log('')
    }

    if (agent.hlAddress) {
      const hlWallet = response.wallets?.hyperliquid
      console.log(`  ${chalk.dim('Hyperliquid (EVM):')}`)
      console.log(`    Address: ${chalk.cyan(agent.hlAddress)}`)
      if (hlWallet) {
        console.log(`    Account Value: ${chalk.green(`$${hlWallet.balanceUsd.toFixed(2)}`)}`)
      }
      console.log('')
    }

    // PnL
    console.log(chalk.bold('Performance'))
    console.log('')
    console.log(`  ${chalk.dim('Total Value:')} ${chalk.white(`$${agent.totalValueUsd.toFixed(2)}`)}`)
    console.log(`  ${chalk.dim('PnL 24h:')}     ${formatPnl(agent.pnl24h, agent.pnl24hPercent)}`)
    console.log(`  ${chalk.dim('PnL 7d:')}      ${formatPnl(agent.pnl7d, agent.pnl7dPercent)}`)
    console.log(`  ${chalk.dim('PnL All:')}     ${formatPnl(agent.pnlAllTime, agent.pnlAllTimePercent)}`)
    console.log('')

    // Quick actions
    if (!agent.verified) {
      console.log(chalk.yellow('Tip: Connect your X account at https://cabal.trading/dashboard'))
      console.log('')
    }
    console.log(`  ${chalk.dim('Docs:')} ${chalk.cyan('https://cabal.trading/trading.md')}`)
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
    default:
      return chalk.dim(status)
  }
}

function formatPnl(value: number, percent: number): string {
  const sign = value >= 0 ? '+' : ''
  const color = value >= 0 ? chalk.green : chalk.red
  return color(`${sign}$${value.toFixed(2)} (${sign}${percent.toFixed(1)}%)`)
}
