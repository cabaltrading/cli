import { exec } from 'child_process'

const SITE = 'https://cabal-trading-staging.cabal-trading.workers.dev'

export const SIGNUP_URL = `${SITE}/signup`
export const DASHBOARD_URL = `${SITE}/dashboard`

export function openBrowser(url: string): Promise<boolean> {
  const platform = process.platform
  const cmd =
    platform === 'darwin' ? `open "${url}"` :
    platform === 'win32' ? `start "" "${url}"` :
    `xdg-open "${url}"`

  return new Promise((resolve) => {
    exec(cmd, (error) => resolve(!error))
  })
}
