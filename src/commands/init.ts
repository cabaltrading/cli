import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { AgentClient } from '../client.js'
import { saveEnv, isConfigured, ensureEnvInGitignore, isEnvInGitignore } from '../lib/env.js'
import { printCliError } from '../lib/errors.js'
import { openBrowser, SIGNUP_URL, DASHBOARD_URL } from '../lib/browser.js'

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

  // Get API key — guide new users through signup if they don't have one
  let apiKey = apiKeyArg
  if (!apiKey) {
    console.log(chalk.bold('  Welcome to Cabal'))
    console.log('')
    console.log('  To connect your agent, you need an API key.')
    console.log('  If you already have one, paste it below.')
    console.log('')

    const { hasKey } = await inquirer.prompt([
      {
        type: 'list',
        name: 'hasKey',
        message: 'Do you have an API key?',
        choices: [
          { name: 'Yes — paste my key', value: 'yes' },
          { name: 'No — sign me up', value: 'no' },
        ],
      },
    ])

    if (hasKey === 'no') {
      console.log('')
      console.log(chalk.bold('  Quick setup:'))
      console.log('')
      console.log(`  ${chalk.dim('1.')} Sign up / log in at the link below`)
      console.log(`  ${chalk.dim('2.')} Copy your API key from the dashboard`)
      console.log(`  ${chalk.dim('3.')} Come back here and paste it`)
      console.log('')

      const { shouldOpen } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldOpen',
          message: `Open ${SIGNUP_URL} in your browser?`,
          default: true,
        },
      ])

      if (shouldOpen) {
        const opened = await openBrowser(SIGNUP_URL)
        if (opened) {
          console.log(chalk.dim('\n  Browser opened. Complete signup, then come back here.\n'))
        } else {
          console.log(chalk.dim(`\n  Could not open browser. Go to: ${chalk.cyan(SIGNUP_URL)}\n`))
        }
      } else {
        console.log(chalk.dim(`\n  Go to: ${chalk.cyan(SIGNUP_URL)}\n`))
      }

      console.log(chalk.dim('  Once you have your key, paste it below.\n'))
    }

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'API key:',
        mask: '*',
        validate: (input: string) => {
          if (!input) return 'API key is required'
          if (!input.startsWith('cabal_')) return 'API key must start with "cabal_" — copy it from your dashboard'
          return true
        },
      },
    ])
    apiKey = answers.apiKey
  }

  // Validate prefix before hitting network
  if (!apiKey!.startsWith('cabal_')) {
    console.log(chalk.red('Error: API key must start with "cabal_"'))
    console.log(chalk.dim(`Get your API key at ${DASHBOARD_URL}`))
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
    console.log(chalk.dim(`Check your API key at ${DASHBOARD_URL}`))
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
