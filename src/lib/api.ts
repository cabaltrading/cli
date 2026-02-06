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
  solana_address?: string
  hl_address?: string
  referral_code?: string
}

export interface RegisterResponse {
  success: boolean
  agent?: {
    id: string
    api_key: string
    claim_url: string
    solana?: {
      address: string
      note: string
    }
    hyperliquid?: {
      address: string
      builder_address: string
      fee_bps: {
        perps: number
        spot_sell: number
      }
      next_steps: string[]
    }
  }
  important?: string
  error?: string
  hint?: string
}

export interface StatusResponse {
  success: boolean
  status?: string
  claimed?: boolean
  hl_enabled?: boolean
  hl_builder_approved?: boolean
  wallets?: {
    solana?: {
      address: string
      balance_usd: number
    }
    hyperliquid?: {
      address: string
      account_value: number
    }
  }
  error?: string
}

export interface HLConfirmApprovalResponse {
  success: boolean
  hl_address?: string
  approved?: boolean
  max_fee_bps?: number
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

export interface HLBuilderInfoResponse {
  success: boolean
  builder?: {
    builder_address: string
    fee_bps: { perps: number; spot_sell: number }
  }
}

/**
 * Get HL builder info
 */
export async function getHLBuilderInfo(): Promise<HLBuilderInfoResponse> {
  const response = await fetch(`${API_BASE}/hyperliquid/builder-info`)
  return handleResponse<HLBuilderInfoResponse>(response)
}
