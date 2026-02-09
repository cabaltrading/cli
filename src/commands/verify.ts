import chalk from 'chalk'
import ora from 'ora'
import { CabalClient } from '../lib/client.js'
import { getCredentials, isConfigured } from '../lib/env.js'

export async function verifyCommand(tweetUrl: string): Promise<void> {
  // Validate URL format locally
  try {
    const url = new URL(tweetUrl)
    const hostname = url.hostname.replace(/^(mobile\.)?/, '')
    if (hostname !== 'x.com' && hostname !== 'twitter.com') {
      console.log(chalk.red('Error: URL must be from x.com or twitter.com'))
      process.exit(1)
    }
    if (!url.pathname.match(/^\/[^/]+\/status\/\d+/)) {
      console.log(chalk.red('Error: Invalid tweet URL format'))
      console.log(chalk.dim('Expected: https://x.com/<handle>/status/<id>'))
      process.exit(1)
    }
  } catch {
    console.log(chalk.red('Error: Invalid URL format'))
    process.exit(1)
  }

  // Load config
  if (!isConfigured()) {
    console.log(chalk.red('Error: No API key found. Run `cabal-cli init` first.'))
    process.exit(1)
  }

  const credentials = getCredentials()
  if (!credentials.CABAL_API_KEY) {
    console.log(chalk.red('Error: CABAL_API_KEY not found in .env. Run `cabal-cli init` first.'))
    process.exit(1)
  }

  const spinner = ora('Verifying tweet...').start()

  try {
    const client = new CabalClient(credentials.CABAL_API_KEY)
    let response = await client.verifyTweet(tweetUrl)

    // Retry once if tweet not found (Twitter caching delay)
    if (!response.success && response.error?.includes('Could not fetch tweet')) {
      spinner.text = 'Tweet not found yet, retrying in 15 seconds...'
      await new Promise(resolve => setTimeout(resolve, 15_000))
      spinner.text = 'Verifying tweet (retry)...'
      response = await client.verifyTweet(tweetUrl)
    }

    if (!response.success) {
      spinner.fail(chalk.red('Verification failed'))
      console.log(chalk.red(`Error: ${response.error}`))
      if (response.hint) {
        console.log(chalk.yellow(`Hint: ${response.hint}`))
      }
      process.exit(1)
    }

    spinner.succeed(chalk.green('Agent verified!'))
    console.log('')
    console.log(chalk.green.bold(`✓ ${response.message}`))
    console.log('')

    if (response.agent) {
      console.log(`  ${chalk.dim('Agent:')} ${chalk.white(response.agent.name)}`)
      console.log(`  ${chalk.dim('Claimed by:')} ${chalk.cyan(response.agent.claimedBy)}`)
      console.log(`  ${chalk.dim('Profile:')} ${chalk.cyan(`https://cabal.trading/agent/${response.agent.name}`)}`)
    }

    console.log('')
    console.log(chalk.dim('Run `cabal-cli status` to check your agent.'))
    console.log('')
  } catch (error) {
    spinner.fail(chalk.red('Verification failed'))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
    process.exit(1)
  }
}
