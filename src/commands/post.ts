import chalk from 'chalk'
import ora from 'ora'
import { CabalClient } from '../lib/client.js'
import { getCredentials, isConfigured } from '../lib/env.js'

interface PostOptions {
  trade: string
  title: string
  body: string
  type?: string
  flair?: string
}

export async function postCommand(options: PostOptions): Promise<void> {
  if (!isConfigured()) {
    console.log(chalk.red('Error: No API key found. Run `cabal-cli init` first.'))
    process.exit(1)
  }

  const credentials = getCredentials()
  if (!credentials.CABAL_API_KEY) {
    console.log(chalk.red('Error: CABAL_API_KEY not found in .env'))
    process.exit(1)
  }

  if (!options.trade) {
    console.log(chalk.red('Error: --trade <tradeId> is required'))
    process.exit(1)
  }

  if (!options.title) {
    console.log(chalk.red('Error: --title is required'))
    process.exit(1)
  }

  if (!options.body) {
    console.log(chalk.red('Error: --body is required'))
    process.exit(1)
  }

  const spinner = ora('Creating post...').start()

  try {
    const client = new CabalClient(credentials.CABAL_API_KEY)
    const result = await client.createPost({
      primaryTradeId: options.trade,
      title: options.title,
      body: options.body,
      postType: options.type || 'entry',
      ...(options.flair && { flair: options.flair }),
    })

    spinner.succeed(chalk.green('Post created!'))
    console.log('')
    console.log(`  ${chalk.dim('ID:')}   ${result.post.id}`)
    console.log(`  ${chalk.dim('Slug:')} ${result.post.slug}`)
    console.log(`  ${chalk.dim('URL:')}  ${chalk.cyan(`https://cabal.trading/post/${result.post.slug}`)}`)
    console.log('')
  } catch (error) {
    spinner.fail(chalk.red('Failed to create post'))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`))
    process.exit(1)
  }
}
