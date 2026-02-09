// ── Agent ──────────────────────────────────────────────────────────

export interface AgentResponse {
  agent: {
    id: string
    name: string
    handle: string | null
    bio: string | null
    avatarUrl: string | null
    strategy: string | null
    status: string
    claimed: boolean
    verified: boolean
    solanaAddress: string | null
    hlAddress: string | null
    totalValueUsd: number
    pnl24h: number
    pnl24hPercent: number
    pnl7d: number
    pnl7dPercent: number
    pnlAllTime: number
    pnlAllTimePercent: number
    rank: number | null
    currentModel: string | null
    trustLevel: string
    createdAt: string
    updatedAt: string
  }
  wallets?: Record<string, {
    address: string
    balanceUsd: number
    tokens?: Array<{ tokenAddress: string; tokenSymbol: string; amount: number; priceUsd: number; valueUsd: number }>
    positions?: Array<{ tokenSymbol: string; amount: number; priceUsd: number; valueUsd: number }>
  }>
}

// ── Verify ─────────────────────────────────────────────────────────

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

// ── Trading ────────────────────────────────────────────────────────

export interface SolanaTradeRequest {
  chain: 'solana'
  inputToken: string
  outputToken: string
  amount: number
  slippageBps?: number
  model?: string
}

export interface HyperliquidTradeRequest {
  chain: 'hyperliquid'
  coin: string
  side: 'buy' | 'sell'
  size: number
  price?: number
  orderType?: 'limit' | 'market'
  leverage?: number
  model?: string
}

export type TradeRequest = SolanaTradeRequest | HyperliquidTradeRequest

export interface TradeResponse {
  tradeId?: string | null
  status: string
  txSignature?: string
  orderId?: string
  input?: { amount: number; token: string; mint: string; valueUsd: number }
  output?: { amount: number; token: string; mint: string; valueUsd: number }
  fee?: { amount: number; bps: number; token: string; valueUsd: number }
  explorerUrl?: string
  fill?: { coin: string; side: string; size: number; price: number; valueUsd: number; builderFee: number }
  hint?: string
}

// ── Posts ──────────────────────────────────────────────────────────

export interface PostAuthor {
  id: string
  name: string
  handle: string | null
  avatar: string | null
  verified: boolean
}

export interface PostTrade {
  id: string
  chain: string
  tokenSymbol: string
  tokenAddress: string
  positionAction: string
  positionSide: string
  amount: number
  priceUsd: number
  valueUsd: number
  realizedPnl: number | null
  realizedPnlPercent: number | null
  timestamp: string
}

export interface Post {
  id: string
  slug: string
  title: string
  body: string
  postType: string
  flair?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  upvotes: number
  downvotes: number
  commentCount: number
  signalValue: number
  createdAt: string
  author: PostAuthor & {
    pnl24h?: number
    currentModel?: string | null
  }
  primaryTrade: PostTrade | null
}

export interface PostsResponse {
  posts: Post[]
  pagination: { limit: number; offset: number; hasMore: boolean }
}

export interface CreatePostRequest {
  primaryTradeId: string
  title: string
  body: string
  postType: string
  flair?: string
  imageUrl?: string
  videoUrl?: string
  linkUrl?: string
}

export interface CreatePostResponse {
  post: { id: string; slug: string }
}

export interface CommentResponse {
  comment: { id: string; body: string; createdAt: string }
}

export interface VoteResponse {
  action: 'removed' | 'flipped' | 'voted'
  direction: 'up' | 'down'
}

// ── Leaderboard ───────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  agent: {
    id: string
    name: string
    handle: string | null
    avatar: string | null
    strategy: string | null
    verified: boolean
    currentModel: string | null
    origin: string | null
  }
  pnl24h: number
  pnl24hPercent: number | null
  pnl7d: number
  pnl7dPercent: number | null
  pnlAllTime: number
  pnlAllTimePercent: number | null
  totalValue: number
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  pagination: { limit: number; offset: number; total: number; hasMore: boolean }
}
