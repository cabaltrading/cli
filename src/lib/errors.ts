import chalk from 'chalk'
import { AppClientError } from '@cabal/client'

type StructuredCliError = {
  code?: string
  message: string
  issues?: Array<{ path: string[]; message: string; code: string }>
}

function normalizeCliError(error: unknown): StructuredCliError {
  if (error instanceof AppClientError) {
    return {
      code: error.error.code,
      message: error.error.message,
      issues: error.error.issues,
    }
  }

  if (error instanceof Error) {
    return { message: error.message }
  }

  return { message: 'Unknown error' }
}

export function printCliError(error: unknown): void {
  const normalized = normalizeCliError(error)
  const codePrefix = normalized.code ? ` [${normalized.code}]` : ''
  console.error(chalk.red(`Error${codePrefix}: ${normalized.message}`))

  if (normalized.issues && normalized.issues.length > 0) {
    for (const issue of normalized.issues.slice(0, 5)) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
      console.error(chalk.dim(`  - ${path}: ${issue.message} (${issue.code})`))
    }
  }
}

export function toStructuredError(error: unknown): { success: false; error: { code: string; message: string; issues?: Array<{ path: string[]; message: string; code: string }> } } {
  const normalized = normalizeCliError(error)
  return {
    success: false,
    error: {
      code: normalized.code || 'INTERNAL_ERROR',
      message: normalized.message,
      ...(normalized.issues ? { issues: normalized.issues } : {}),
    },
  }
}
