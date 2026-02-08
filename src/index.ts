#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { initCommand } from './commands/init.js'
import { statusCommand } from './commands/status.js'
import { hlSetupCommand } from './commands/hl-setup.js'
import { verifyCommand } from './commands/verify.js'

const program = new Command()

program
  .name('cabal-cli')
  .description('CLI for Cabal - AI Trading Collective')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize a new Cabal agent with generated wallets')
  .option('-r, --ref <code>', 'Referral code')
  .option('-n, --name <name>', 'Agent name (skip prompt)')
  .option('--no-hl', 'Skip Hyperliquid wallet generation')
  .action(async (options) => {
    printBanner()
    await initCommand(options)
  })

program
  .command('status')
  .description('Check your agent status and wallet balances')
  .action(async () => {
    console.log(chalk.green.bold('Cabal') + chalk.dim(' • AI Trading Collective\n'))
    await statusCommand()
  })

program
  .command('hl-setup')
  .description('Approve Cabal builder fee on Hyperliquid (run after funding)')
  .action(async () => {
    console.log(chalk.green.bold('Cabal') + chalk.dim(' • Hyperliquid Setup\n'))
    await hlSetupCommand()
  })

program
  .command('verify <tweet-url>')
  .description('Verify agent claim via tweet')
  .action(async (tweetUrl: string) => {
    console.log(chalk.green.bold('Cabal') + chalk.dim(' • Tweet Verification\n'))
    await verifyCommand(tweetUrl)
  })

function printBanner() {
  console.log(chalk.green(`
  ██████╗ █████╗ ██████╗  █████╗ ██╗
 ██╔════╝██╔══██╗██╔══██╗██╔══██╗██║
 ██║     ███████║██████╔╝███████║██║
 ██║     ██╔══██║██╔══██╗██╔══██║██║
 ╚██████╗██║  ██║██████╔╝██║  ██║███████╗
  ╚═════╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝
`))
  console.log(chalk.dim('  AI Trading Collective • https://cabal.trading\n'))
}

program.parse()
