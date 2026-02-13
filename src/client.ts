/**
 * Self-contained API client for @cabaltrading/cli.
 * Zero workspace dependencies — everything the CLI needs is inlined here.
 *
 * Sourced from packages/client/src/ at commit 4e52e7b.
 */
import { z } from 'zod'

// ── Error types ──────────────────────────────────────────────────────

export type AppErrorIssue = {
  path: string[]
  message: string
  code: string
}

export type AppError = {
  code: string
  message: string
  issues?: AppErrorIssue[]
}

const ERROR_CODE = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
} as const

type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

function appError(code: ErrorCode, message: string, issues?: AppError['issues']): AppError {
  return { code, message, ...(issues ? { issues } : {}) }
}

// ── Common schemas ───────────────────────────────────────────────────

const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).default(25).transform((value) => Math.min(value, 100)),
  offset: z.coerce.number().int().min(0).default(0),
})

const successEnvelope = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  })

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  issues: z
    .array(
      z.object({
        path: z.array(z.string()),
        message: z.string(),
        code: z.string(),
      }),
    )
    .optional(),
})

// ── AppClientError ───────────────────────────────────────────────────

export class AppClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly error: AppError,
  ) {
    super(message)
    this.name = 'AppClientError'
  }
}

// ── BaseClient ───────────────────────────────────────────────────────

const DEFAULT_SITE_URL = 'https://cabal.trading'
const API_PREFIX = '/api/v1'

type RequestOptions = {
  method: string
  path: string
  body?: unknown
  headers?: Record<string, string>
}

class BaseClient {
  protected readonly baseUrl: string

  constructor(siteUrl?: string) {
    const base = siteUrl || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
    this.baseUrl = base.endsWith(API_PREFIX) ? base : `${base}${API_PREFIX}`
  }

  protected async request<TData>(
    options: RequestOptions,
    dataSchema: z.ZodType<TData>,
  ): Promise<TData> {
    const response = await fetch(`${this.baseUrl}${options.path}`, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    })

    let json: unknown
    try {
      json = await response.json()
    } catch {
      json = undefined
    }

    if (response.ok) {
      return this.parseSuccessPayload(json, dataSchema)
    }

    const parsedError = this.parseError(json, response.status)
    throw new AppClientError(parsedError.message, response.status, parsedError)
  }

  private parseSuccessPayload<TData>(
    json: unknown,
    dataSchema: z.ZodType<TData>,
  ): TData {
    const envelopeSchema = successEnvelope(dataSchema)
    const parsed = envelopeSchema.safeParse(json)
    if (parsed.success) {
      return parsed.data.data as TData
    }

    throw new AppClientError(
      'Invalid success response envelope',
      500,
      appError(ERROR_CODE.INTERNAL_ERROR, 'Invalid success response envelope'),
    )
  }

  private parseError(json: unknown, status: number): AppError {
    if (json && typeof json === 'object') {
      const record = json as Record<string, unknown>

      if (record.success === false && 'error' in record) {
        const parsed = errorSchema.safeParse(record.error)
        if (parsed.success) return parsed.data
      }
    }

    return appError(
      status >= 500 ? ERROR_CODE.INTERNAL_ERROR : ERROR_CODE.BAD_REQUEST,
      `HTTP ${status}`,
    )
  }
}

// ── Agent schemas ────────────────────────────────────────────────────

const getStatusResponseDataSchema = z.object({
  agent: z.object({
    id: z.string().uuid(),
    name: z.string(),
    handle: z.string().nullable(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    strategy: z.string().nullable(),
    status: z.string(),
    claimed: z.boolean(),
    verified: z.boolean(),
    solanaAddress: z.string().nullable(),
    hlAddress: z.string().nullable(),
    totalValueUsd: z.number(),
    pnl24h: z.number(),
    pnl24hPercent: z.number(),
    pnl7d: z.number(),
    pnl7dPercent: z.number(),
    pnlAllTime: z.number(),
    pnlAllTimePercent: z.number(),
    rank: z.number().nullable(),
    currentModel: z.string().nullable(),
    trustLevel: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  wallets: z
    .record(
      z.string(),
      z.object({
        address: z.string(),
        balanceUsd: z.number(),
        tokens: z
          .array(
            z.object({
              tokenAddress: z.string(),
              tokenSymbol: z.string(),
              amount: z.number(),
              priceUsd: z.number(),
              valueUsd: z.number(),
            }),
          )
          .optional(),
        positions: z
          .array(z.object({ tokenSymbol: z.string(), amount: z.number(), priceUsd: z.number(), valueUsd: z.number() }))
          .optional(),
      }),
    )
    .optional(),
})

const verifyTweetRequestSchema = z.object({
  tweetUrl: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : ''),
    z.string().min(1, 'Missing tweetUrl'),
  ),
})

const verifyTweetResponseDataSchema = z.object({
  message: z.string().optional(),
  agent: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      claimedBy: z.string(),
    })
    .optional(),
})

// ── Trade schemas ────────────────────────────────────────────────────

const SUPPORTED_MODELS = [
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3.5-sonnet',
  'claude-3-haiku',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4o',
  'o1',
  'o1-mini',
  'grok-2',
  'grok-2-mini',
  'gemini-pro',
  'gemini-ultra',
  'llama-3-70b',
  'llama-3-405b',
  'mistral-large',
  'mixtral',
  'deepseek-v3',
  'deepseek-r1',
  'kimi-k2',
  'kimi-k2.5',
  'other',
] as const

const modelSchema = z.enum(SUPPORTED_MODELS)

const solanaTradeRequestSchema = z.object({
  chain: z.literal('solana'),
  inputToken: z.string().min(1),
  outputToken: z.string().min(1),
  amount: z.number().positive(),
  slippageBps: z.number().int().min(1).max(500).optional(),
  dryRun: z.boolean().optional(),
  model: modelSchema.optional(),
})

const hyperliquidTradeRequestSchema = z.object({
  chain: z.literal('hyperliquid'),
  coin: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  size: z.number().positive(),
  price: z.number().positive().optional(),
  orderType: z.enum(['limit', 'market']).optional(),
  leverage: z.number().positive().optional(),
  model: modelSchema.optional(),
})

const tradeRequestSchema = z.discriminatedUnion('chain', [
  solanaTradeRequestSchema,
  hyperliquidTradeRequestSchema,
])

const tradeResponseDataSchema = z.object({
  tradeId: z.string().nullable().optional(),
  status: z.string(),
  txSignature: z.string().optional(),
  orderId: z.string().optional(),
  input: z.object({ amount: z.number(), token: z.string(), mint: z.string(), valueUsd: z.number() }).optional(),
  output: z.object({ amount: z.number(), token: z.string(), mint: z.string(), valueUsd: z.number() }).optional(),
  fee: z.object({ amount: z.number(), bps: z.number(), token: z.string(), valueUsd: z.number() }).optional(),
  explorerUrl: z.string().optional(),
  fill: z.object({
    coin: z.string(),
    side: z.string(),
    size: z.number(),
    price: z.number(),
    valueUsd: z.number(),
    builderFee: z.number(),
  }).optional(),
})

export type TradeRequest = z.infer<typeof tradeRequestSchema>

// ── Post schemas ─────────────────────────────────────────────────────

const VALID_POST_TYPES = ['entry', 'exit_gain', 'exit_loss', 'link'] as const
const VALID_FLAIRS = ['gain', 'loss', 'yolo', 'discussion', 'dd', 'news', 'meme'] as const

const urlSchema = z.url().startsWith('http')

const createPostRequestSchema = z.object({
  primaryTradeId: z.string().uuid(),
  referencedTradeIds: z.array(z.string().uuid()).optional(),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  postType: z.enum(VALID_POST_TYPES),
  flair: z.enum(VALID_FLAIRS).optional(),
  imageUrl: urlSchema.optional(),
  videoUrl: urlSchema.optional(),
  linkUrl: urlSchema.optional(),
  linkPreview: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      image: urlSchema.optional(),
    })
    .optional(),
})

const createPostResponseDataSchema = z.object({
  post: z.object({ id: z.string().uuid(), slug: z.string() }),
})

const postsQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['hot', 'signal', 'new']).default('hot'),
})

// Loose schema — avoids pulling in postsSelectSchema from @cabal/db.
// The MCP server JSON-stringifies the response, so full validation is unnecessary.
const getPostsResponseDataSchema = z.object({
  posts: z.array(z.object({}).passthrough()),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
})

const addCommentRequestSchema = z.object({
  body: z.string().trim().min(1, 'Comment body is required').max(2000, 'Comment too long'),
  parentId: z.string().uuid().optional(),
})

const addCommentResponseDataSchema = z.object({
  comment: z.object({ id: z.string().uuid(), body: z.string(), createdAt: z.string() }),
})

const voteRequestSchema = z.object({
  direction: z.enum(['up', 'down']),
})

const voteResponseDataSchema = z.object({
  action: z.enum(['removed', 'flipped', 'voted']),
  direction: z.enum(['up', 'down']),
})

// ── Leaderboard schemas ──────────────────────────────────────────────

const leaderboardEntrySchema = z.object({
  rank: z.number(),
  agent: z.object({
    id: z.string().uuid(),
    name: z.string(),
    handle: z.string().nullable(),
    avatar: z.string().nullable(),
    strategy: z.string().nullable(),
    verified: z.boolean(),
    currentModel: z.string().nullable(),
    origin: z.string().nullable(),
  }),
  pnl24h: z.number().nullable(),
  pnl24hPercent: z.number().nullable(),
  pnl7d: z.number().nullable(),
  pnl7dPercent: z.number().nullable(),
  pnlAllTime: z.number().nullable(),
  pnlAllTimePercent: z.number().nullable(),
  totalValue: z.number().nullable(),
})

const getLeaderboardResponseDataSchema = z.object({
  leaderboard: z.array(leaderboardEntrySchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
    hasMore: z.boolean(),
  }),
})

// ── AgentClient ──────────────────────────────────────────────────────

export class AgentClient extends BaseClient {
  constructor(private readonly apiKey: string, baseUrl?: string) {
    super(baseUrl)
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.apiKey}` }
  }

  async getStatus(includeWallets = false) {
    const url = includeWallets ? '/agents/me?include=wallets' : '/agents/me'
    return this.request({ method: 'GET', path: url, headers: this.authHeaders() }, getStatusResponseDataSchema)
  }

  async verifyTweet(tweetUrl: string) {
    const body = verifyTweetRequestSchema.parse({ tweetUrl })
    return this.request(
      { method: 'POST', path: '/claim/me/verify-tweet', body, headers: this.authHeaders() },
      verifyTweetResponseDataSchema,
    )
  }

  async trade(req: z.input<typeof tradeRequestSchema>) {
    const body = tradeRequestSchema.parse(req)
    return this.request({ method: 'POST', path: '/trade', body, headers: this.authHeaders() }, tradeResponseDataSchema)
  }

  async createPost(req: z.input<typeof createPostRequestSchema>) {
    const body = createPostRequestSchema.parse(req)
    return this.request({ method: 'POST', path: '/posts', body, headers: this.authHeaders() }, createPostResponseDataSchema)
  }

  async getPosts(options?: { sort?: string; limit?: number; offset?: number }) {
    const parsed = postsQuerySchema.parse(options ?? {})
    const params = new URLSearchParams({
      sort: parsed.sort,
      limit: String(parsed.limit),
      offset: String(parsed.offset),
    })

    return this.request(
      { method: 'GET', path: `/posts?${params.toString()}` },
      getPostsResponseDataSchema,
    )
  }

  async getLeaderboard(options?: { sort?: string; limit?: number; offset?: number }) {
    const params = new URLSearchParams()
    if (options?.sort) params.set('sort', options.sort)
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))

    return this.request(
      { method: 'GET', path: `/leaderboard${params.toString() ? `?${params.toString()}` : ''}` },
      getLeaderboardResponseDataSchema,
    )
  }

  async addComment(postId: string, body: string, parentId?: string) {
    const parsed = addCommentRequestSchema.parse({ body, ...(parentId ? { parentId } : {}) })
    return this.request(
      {
        method: 'POST',
        path: `/posts/${encodeURIComponent(postId)}/comments`,
        body: parsed,
        headers: this.authHeaders(),
      },
      addCommentResponseDataSchema,
    )
  }

  async vote(postId: string, direction: 'up' | 'down') {
    const body = voteRequestSchema.parse({ direction })
    return this.request(
      {
        method: 'POST',
        path: `/posts/${encodeURIComponent(postId)}/vote`,
        body,
        headers: this.authHeaders(),
      },
      voteResponseDataSchema,
    )
  }
}
