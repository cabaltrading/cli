const API_BASE = process.env.CABAL_API_URL || 'https://cabal.trading/api/v1'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const data = await response.json() as { error?: string; message?: string }
      errorMessage = data.error || data.message || errorMessage
    } catch {
      // Response wasn't JSON
    }
    throw new Error(errorMessage)
  }
  return response.json() as Promise<T>
}

export interface RegisterRequest {
  name: string
  solanaAddress?: string
  hlAddress?: string
  referralCode?: string
}

export interface RegisterResponse {
  success: boolean
  agent?: {
    id: string
    apiKey: string
    claimUrl: string
    verificationCode?: string
    tweetTemplate?: string
    referralUrl?: string
    expiresAt?: string
    solana?: {
      address: string
      note: string
    }
    hyperliquid?: {
      address: string
      builderAddress: string
      feeBps: {
        perps: number
        spotSell: number
      }
      nextSteps: string[]
    }
  }
  important?: string
  error?: string
  hint?: string
}

export interface VerifyTweetResponse {
  success: boolean
  message?: string
  agent?: {
    id: string
    name: string
    claimedBy: string
  }
  error?: string
  hint?: string
}

export interface StatusResponse {
  success: boolean
  status?: string
  claimed?: boolean
  hlEnabled?: boolean
  hlBuilderApproved?: boolean
  wallets?: {
    solana?: {
      address: string
      balanceUsd: number
    }
    hyperliquid?: {
      address: string
      accountValue: number
    }
  }
  error?: string
}

export interface HLConfirmApprovalResponse {
  success: boolean
  hlAddress?: string
  approved?: boolean
  maxFeeBps?: number
  message?: string
  error?: string
}

/**
 * Register a new agent with Cabal
 */
export async function registerAgent(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE}/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  // Registration returns success: false for validation errors, so don't throw
  return response.json() as Promise<RegisterResponse>
}

/**
 * Get agent status
 */
export async function getAgentStatus(apiKey: string): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE}/agents/me`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  return handleResponse<StatusResponse>(response)
}

/**
 * Confirm HL builder approval with Cabal
 */
export async function confirmHLApproval(apiKey: string): Promise<HLConfirmApprovalResponse> {
  const response = await fetch(`${API_BASE}/hyperliquid/confirm-approval`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  return handleResponse<HLConfirmApprovalResponse>(response)
}

/**
 * Verify agent claim via tweet
 */
export async function verifyTweet(apiKey: string, tweetUrl: string): Promise<VerifyTweetResponse> {
  const response = await fetch(`${API_BASE}/claim/me/verify-tweet`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tweetUrl }),
  })

  return handleResponse<VerifyTweetResponse>(response)
}
