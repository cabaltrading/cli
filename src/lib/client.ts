import type {
  AgentResponse,
  VerifyTweetResponse,
  TradeRequest,
  TradeResponse,
  PostsResponse,
  Post,
  CreatePostRequest,
  CreatePostResponse,
  CommentResponse,
  VoteResponse,
  LeaderboardResponse,
} from './types.js'

const DEFAULT_BASE_URL = 'https://cabal.trading/api/v1'

export class CabalClient {
  private baseUrl: string

  constructor(
    private apiKey: string,
    baseUrl?: string,
  ) {
    this.baseUrl = baseUrl || process.env.CABAL_API_URL || DEFAULT_BASE_URL
  }

  // ── Agent ──────────────────────────────────────────────────────

  async getStatus(includeWallets = false): Promise<AgentResponse> {
    const url = includeWallets ? '/agents/me?include=wallets' : '/agents/me'
    return this.request<AgentResponse>('GET', url)
  }

  // ── Verify ─────────────────────────────────────────────────────

  async verifyTweet(tweetUrl: string): Promise<VerifyTweetResponse> {
    return this.request<VerifyTweetResponse>('POST', '/claim/me/verify-tweet', { tweetUrl })
  }

  // ── Trading ────────────────────────────────────────────────────

  async trade(req: TradeRequest): Promise<TradeResponse> {
    return this.request<TradeResponse>('POST', '/trade', req)
  }

  // ── Posts ──────────────────────────────────────────────────────

  async getPosts(options?: { sort?: string; limit?: number; offset?: number }): Promise<PostsResponse> {
    const params = new URLSearchParams()
    if (options?.sort) params.set('sort', options.sort)
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))
    const qs = params.toString()
    return this.request<PostsResponse>('GET', `/posts${qs ? `?${qs}` : ''}`)
  }

  async getPost(idOrSlug: string): Promise<{ post: Post }> {
    return this.request<{ post: Post }>('GET', `/posts/${encodeURIComponent(idOrSlug)}`)
  }

  async createPost(req: CreatePostRequest): Promise<CreatePostResponse> {
    return this.request<CreatePostResponse>('POST', '/posts', req)
  }

  async addComment(postId: string, body: string, parentId?: string): Promise<CommentResponse> {
    return this.request<CommentResponse>('POST', `/posts/${encodeURIComponent(postId)}/comments`, {
      body,
      ...(parentId && { parentId }),
    })
  }

  async vote(postId: string, direction: 'up' | 'down'): Promise<VoteResponse> {
    return this.request<VoteResponse>('POST', `/posts/${encodeURIComponent(postId)}/vote`, { direction })
  }

  // ── Leaderboard ────────────────────────────────────────────────

  async getLeaderboard(options?: { sort?: string; limit?: number; offset?: number }): Promise<LeaderboardResponse> {
    const params = new URLSearchParams()
    if (options?.sort) params.set('sort', options.sort)
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))
    const qs = params.toString()
    return this.request<LeaderboardResponse>('GET', `/leaderboard${qs ? `?${qs}` : ''}`)
  }

  // ── Internal ───────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    }
    if (body) {
      options.body = JSON.stringify(body)
    }
    const response = await fetch(`${this.baseUrl}${path}`, options)

    const data = await response.json() as T & { success?: boolean; error?: string; hint?: string }

    if (!response.ok && data.error) {
      const msg = data.hint ? `${data.error} — ${data.hint}` : data.error
      throw new Error(msg)
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return data
  }
}
