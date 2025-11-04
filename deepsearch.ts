// Simplified DeepSearch agent using a web search API (v1)
// Provides rapid web + news search to seed Browser Tools exploration
// Search Operators: https://documentation.you.com/developer-resources/search-operators

export interface YouSearchItem {
  url: string;
  title?: string;
  description?: string;
  page_age?: string; // ISO datetime
  source?: 'web' | 'news';
}

export interface DeepSearchResult {
  plan: string;
  items: YouSearchItem[];
}

type FetchLike = typeof fetch;

class YouSearchClient {
  private apiKey: string;
  private baseUrl: string;
  private fetchFn: FetchLike;

  constructor(opts: { apiKey: string; baseUrl?: string; fetchFn?: FetchLike }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl || 'https://api.ydc-index.io').replace(/\/$/, '');
    this.fetchFn = opts.fetchFn || fetch.bind(globalThis);
  }

  /**
   * Unified search with support for advanced search operators
   * Search Operators: https://documentation.you.com/developer-resources/search-operators
   * 
   * Example operators:
   * - site:example.com - Search within a specific site
   * - filetype:pdf - Search for specific file types
   * - intitle:"keyword" - Search in page titles
   * - inurl:"keyword" - Search in URLs
   * - "exact phrase" - Exact phrase match
   * - -exclude - Exclude terms
   * - OR - Boolean OR operator
   */
  async unifiedSearch(params: {
    query: string;
    count?: number;
    freshness?: 'day' | 'week' | 'month' | 'year';
    country?: string; // e.g., 'US'
    safesearch?: 'off' | 'moderate' | 'strict';
  }): Promise<{ web: YouSearchItem[]; news: YouSearchItem[] }> {
    const url = new URL(this.baseUrl + '/v1/search');
    url.searchParams.set('query', params.query);
    if (params.count) url.searchParams.set('count', String(params.count));
    if (params.freshness) url.searchParams.set('freshness', params.freshness);
    if (params.country) url.searchParams.set('country', params.country);
    if (params.safesearch) url.searchParams.set('safesearch', params.safesearch);

    const res = await this.fetchFn(url.toString(), {
      method: 'GET',
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const errorInfo = await this.parseError(res, text);
      throw new Error(`You Search API failed: ${errorInfo.message}`);
    }
    const json: any = await res.json();
    const results = json?.results || {};
    const webRaw: any[] = Array.isArray(results.web) ? results.web : [];
    const newsRaw: any[] = Array.isArray(results.news) ? results.news : [];

    const toItem = (r: any, source: 'web' | 'news'): YouSearchItem => ({
      url: String(r.url || ''),
      title: r.title || undefined,
      description: (Array.isArray(r.snippets) ? r.snippets?.[0] : r.description) || undefined,
      page_age: r.page_age || undefined,
      source,
    });

    return {
      web: webRaw.map((r) => toItem(r, 'web')).filter((i) => !!i.url),
      news: newsRaw.map((r) => toItem(r, 'news')).filter((i) => !!i.url),
    };
  }

  /**
   * Parse web search API errors
   * Based on: https://documentation.you.com/developer-resources/errors
   */
  private async parseError(response: Response, text: string): Promise<{ message: string; code?: string }> {
    try {
      const json = JSON.parse(text);
      return {
        message: json.error?.message || json.message || `HTTP ${response.status}`,
        code: json.error?.code,
      };
    } catch {
      return {
        message: text || `HTTP ${response.status} ${response.statusText}`,
      };
    }
  }
}

function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    u.hash = '';
    // Remove common tracking params
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((p) =>
      u.searchParams.delete(p)
    );
    return u.toString();
  } catch {
    return null;
  }
}

function dedup(items: YouSearchItem[]): YouSearchItem[] {
  const seen = new Set<string>();
  const out: YouSearchItem[] = [];
  for (const it of items) {
    const n = normalizeUrl(it.url);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push({ ...it, url: n });
  }
  return out;
}

function diversifyByHostname(items: YouSearchItem[], perHost = 2): YouSearchItem[] {
  const counts = new Map<string, number>();
  const out: YouSearchItem[] = [];
  for (const it of items) {
    try {
      const host = new URL(it.url).hostname;
      const count = counts.get(host) || 0;
      if (count < perHost) {
        counts.set(host, count + 1);
        out.push(it);
      }
    } catch {
      out.push(it);
    }
  }
  return out;
}

function isFreshISO(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  // More recent -> higher score (within ~1 year window)
  const now = Date.now();
  const diffDays = Math.max(0, (now - t) / (1000 * 60 * 60 * 24));
  return Math.max(0, 365 - diffDays); // 0..365
}

export async function runDeepSearch(query: string, opts: {
  youApiKey: string;
  baseUrl?: string;
  count?: number; // per section
  preferFresh?: boolean;
}): Promise<DeepSearchResult> {
  const client = new YouSearchClient({ apiKey: opts.youApiKey, baseUrl: opts.baseUrl });
  const count = Math.min(Math.max(opts.count ?? 10, 1), 30);

  // Basic heuristic for freshness: if prompt contains time terms, bias to fresher
  const qLower = query.toLowerCase();
  const preferFresh = opts.preferFresh ?? /today|this week|breaking|latest|news|recent|now|202\d|20\d{2}/.test(qLower);
  const freshness: 'day' | 'week' | 'month' | 'year' | undefined = preferFresh ? 'week' : undefined;

  const { web, news } = await client.unifiedSearch({ query, count, freshness, safesearch: 'moderate' });

  // Score results: web baseline 1, news + freshness bonus
  const scored = [...web, ...news].map((i) => ({
    item: i,
    score: (i.source === 'news' ? 1.2 : 1) + (preferFresh ? isFreshISO(i.page_age) / 365 : 0),
  }));

  scored.sort((a, b) => b.score - a.score);
  const ranked = scored.map((s) => s.item);
  const deduped = dedup(ranked);
  const diversified = diversifyByHostname(deduped, 2).slice(0, count * 2); // keep a balanced set

  const plan = [
    'Search plan:',
    `• Seed exploration with ${diversified.length} high-signal sources (web + news).`,
    '• Start by opening the first 2–3 links to get an overview.',
    '• Extract key facts, entities, and claims; note publication dates.',
    '• Branch to additional sources from the list only if gaps remain.',
  ].join('\n');

  return { plan, items: diversified };
}
