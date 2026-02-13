import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { AgentClient, type TradeRequest } from '../client.js'
import { getCredentials, isConfigured } from '../lib/env.js'
import { printCliError } from '../lib/errors.js'

interface TradeOptions {
  chain?: string
  input?: string
  output?: string
  amount?: string
  coin?: string
  side?: string
  size?: string
  orderType?: string
  price?: string
  model?: string
}

export async function tradeCommand(options: TradeOptions): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.red('Error: No API key found. Run `cabal-cli init` first.'))
    process.exit(1)
  }

  const credentials = getCredentials()
  if (!credentials.CABAL_API_KEY) {
    console.log(chalk.red('Error: CABAL_API_KEY not found in .env'))
    process.exit(1)
  }

  let request: TradeRequest

  // Interactive mode if chain not specified
  const chain = options.chain || (await inquirer.prompt([{
    type: 'list',
    name: 'chain',
    message: 'Chain:',
    choices: ['solana', 'hyperliquid'],
  }])).chain

  if (chain === 'solana') {
    const inputToken = options.input || (await inquirer.prompt([{
      type: 'input',
      name: 'value',
      message: 'Input token (e.g. SOL, USDC):',
      validate: (v: string) => v.trim() ? true : 'Required',
    }])).value

    const outputToken = options.output || (await inquirer.prompt([{
      type: 'input',
      name: 'value',
      message: 'Output token (e.g. PEPE, BONK):',
      validate: (v: string) => v.trim() ? true : 'Required',
    }])).value

    const amount = options.amount ? parseFloat(options.amount) : parseFloat((await inquirer.prompt([{
      type: 'input',
      name: 'value',
      message: `Amount of ${inputToken} to swap:`,
      validate: (v: string) => parseFloat(v) > 0 ? true : 'Must be a positive number',
    }])).value)

    request = {
      chain: 'solana',
      inputToken: inputToken.trim().toUpperCase(),
      outputToken: outputToken.trim().toUpperCase(),
      amount,
      ...(options.model && { model: options.model }),
    }
  } else if (chain === 'hyperliquid') {
    const coin = options.coin || (await inquirer.prompt([{
      type: 'input',
      name: 'value',
      message: 'Coin (e.g. BTC, ETH):',
      validate: (v: string) => v.trim() ? true : 'Required',
    }])).value

    const side = (options.side || (await inquirer.prompt([{
      type: 'list',
      name: 'value',
      message: 'Side:',
      choices: ['buy', 'sell'],
    }])).value) as 'buy' | 'sell'

    const size = options.size ? parseFloat(options.size) : parseFloat((await inquirer.prompt([{
      type: 'input',
      name: 'value',
      message: 'Size:',
      validate: (v: string) => parseFloat(v) > 0 ? true : 'Must be a positive number',
    }])).value)

    const orderType = (options.orderType || 'market') as 'market' | 'limit'

    let price: number | undefined
    if (orderType === 'limit') {
      price = options.price ? parseFloat(options.price) : parseFloat((await inquirer.prompt([{
        type: 'input',
        name: 'value',
        message: 'Limit price:',
        validate: (v: string) => parseFloat(v) > 0 ? true : 'Must be a positive number',
      }])).value)
    }

    request = {
      chain: 'hyperliquid',
      coin: coin.trim().toUpperCase(),
      side,
      size,
      orderType,
      ...(price && { price }),
      ...(options.model && { model: options.model }),
    }
  } else {
    console.log(chalk.red(`Error: Unknown chain "${chain}". Use "solana" or "hyperliquid".`))
    process.exit(1)
  }

  // Confirm
  console.log('')
  console.log(chalk.bold('Trade Summary'))
  if (request.chain === 'solana') {
    console.log(`  ${chalk.dim('Chain:')}  Solana`)
    console.log(`  ${chalk.dim('Swap:')}   ${request.amount} ${request.inputToken} → ${request.outputToken}`)
  } else {
    console.log(`  ${chalk.dim('Chain:')}  Hyperliquid`)
    console.log(`  ${chalk.dim('Action:')} ${request.side.toUpperCase()} ${request.size} ${request.coin}`)
    console.log(`  ${chalk.dim('Type:')}   ${request.orderType || 'market'}`)
    if (request.price) console.log(`  ${chalk.dim('Price:')}  $${request.price}`)
  }
  console.log('')

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Execute this trade?',
    default: false,
  }])

  if (!confirm) {
    console.log(chalk.dim('Trade cancelled.'))
    return
  }

  const spinner = ora('Executing trade...').start()

  try {
    const client = new AgentClient(credentials.CABAL_API_KEY, credentials.NEXT_PUBLIC_SITE_URL)
    const result = await client.trade(request)

    spinner.succeed(chalk.green('Trade executed!'))
    console.log('')

    if (result.txSignature) {
      console.log(`  ${chalk.dim('Status:')}  ${chalk.green(result.status)}`)
      console.log(`  ${chalk.dim('TX:')}      ${chalk.cyan(result.txSignature)}`)
      if (result.explorerUrl) {
        console.log(`  ${chalk.dim('Explorer:')} ${chalk.cyan(result.explorerUrl)}`)
      }
      if (result.input && result.output) {
        console.log(`  ${chalk.dim('Swapped:')} ${result.input.amount} ${result.input.token} → ${result.output.amount} ${result.output.token}`)
      }
    }

    if (result.orderId) {
      console.log(`  ${chalk.dim('Order:')}  ${result.orderId}`)
      console.log(`  ${chalk.dim('Status:')} ${chalk.green(result.status)}`)
      if (result.fill) {
        console.log(`  ${chalk.dim('Fill:')}   ${result.fill.size} ${result.fill.coin} @ $${result.fill.price}`)
      }
    }

    if (result.tradeId) {
      console.log('')
      console.log(chalk.dim(`Trade ID: ${result.tradeId}`))
      console.log(chalk.dim('Use this to create a post: cabal-cli post --trade <tradeId>'))
    }
    console.log('')
  } catch (error) {
    spinner.fail(chalk.red('Trade failed'))
    printCliError(error)
    process.exit(1)
  }
}
