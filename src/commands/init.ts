import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { AgentClient } from '../client.js'
import { saveEnv, isConfigured, ensureEnvInGitignore, isEnvInGitignore } from '../lib/env.js'
import { printCliError } from '../lib/errors.js'

export async function initCommand(apiKeyArg?: string): Promise<void> {
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

  // Get API key
  let apiKey = apiKeyArg
  if (!apiKey) {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'API key (from https://cabal.trading/dashboard):',
        mask: '*',
        validate: (input: string) => {
          if (!input) return 'API key is required'
          if (!input.startsWith('cabal_')) return 'API key must start with "cabal_"'
          return true
        },
      },
    ])
    apiKey = answers.apiKey
  }

  // Validate prefix before hitting network
  if (!apiKey!.startsWith('cabal_')) {
    console.log(chalk.red('Error: API key must start with "cabal_"'))
    console.log(chalk.dim('Get your API key at https://cabal.trading/dashboard'))
    process.exit(1)
  }

  console.log('')

  // Validate with server
  const spinner = ora('Validating API key...').start()

  try {
    const client = new AgentClient(apiKey!)
    const response = await client.getStatus()

    spinner.succeed('API key validated!')

    const agent = response.agent

    // Save credentials
    spinner.start('Saving credentials to .env...')

    saveEnv({
      apiKey: apiKey!,
      agentName: agent.name,
    })

    spinner.succeed('Credentials saved to .env')

    // Check/add .gitignore
    const gitignoreResult = ensureEnvInGitignore()
    if (gitignoreResult.created) {
      console.log(chalk.dim('  Created .gitignore with .env'))
    } else if (gitignoreResult.added) {
      console.log(chalk.dim('  Added .env to .gitignore'))
    } else if (!isEnvInGitignore()) {
      console.log(chalk.yellow('  Warning: .env is not in .gitignore — add it to avoid committing secrets!'))
    }

    // Success message
    console.log('')
    console.log(chalk.green.bold('Agent connected!'))
    console.log('')

    // Agent info
    console.log(`  ${chalk.dim('Name:')}     ${chalk.white(agent.name)}`)
    console.log(`  ${chalk.dim('Status:')}   ${getStatusBadge(agent.status)}`)
    console.log(`  ${chalk.dim('Verified:')} ${agent.verified ? chalk.green('Yes') : chalk.yellow('No')}`)
    console.log('')

    // Wallets
    if (agent.solanaAddress) {
      console.log(`  ${chalk.dim('Solana:')}   ${chalk.cyan(agent.solanaAddress)}`)
    }
    if (agent.hlAddress) {
      console.log(`  ${chalk.dim('EVM/HL:')}   ${chalk.cyan(agent.hlAddress)}`)
    }
    console.log('')

    // PnL summary
    if (agent.totalValueUsd > 0) {
      console.log(`  ${chalk.dim('Value:')}    ${chalk.green(`$${agent.totalValueUsd.toFixed(2)}`)}`)
      console.log(`  ${chalk.dim('PnL 24h:')} ${formatPnl(agent.pnl24h, agent.pnl24hPercent)}`)
    }
    console.log('')

    console.log(chalk.dim('Run `cabal-cli status` to check balances.'))
    console.log('')

  } catch (error) {
    spinner.fail(chalk.red('Failed to validate API key'))
    printCliError(error)
    console.log('')
    console.log(chalk.dim('Check your API key at https://cabal.trading/dashboard'))
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

function formatPnl(value: number, percent: number): string {
  const sign = value >= 0 ? '+' : ''
  const color = value >= 0 ? chalk.green : chalk.red
  return color(`${sign}$${value.toFixed(2)} (${sign}${percent.toFixed(1)}%)`)
}
