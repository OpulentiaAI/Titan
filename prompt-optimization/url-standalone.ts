/**
 * Standalone URL parsing utilities from Jina AI DeepResearch
 * Enhanced URL normalization and parsing for GEPA optimization
 */

export interface SearchSnippet {
  url: string;
  title: string;
  description: string;
  weight?: number;
}

export interface BoostedSearchSnippet extends SearchSnippet {
  jinaRerankBoost?: number;
  freqBoost?: number;
  hostnameBoost?: number;
  pathBoost?: number;
  finalScore?: number;
}

export function normalizeUrl(
  urlString: string,
  debug = false,
  options = {
    removeAnchors: true,
    removeSessionIDs: true,
    removeUTMParams: true,
    removeTrackingParams: true,
    removeXAnalytics: true
  }
) {
  try {
    urlString = urlString.replace(/\s+/g, '').trim();

    if (!urlString?.trim()) {
      throw new Error('Empty URL');
    }

    if (urlString.startsWith('https://google.com/') ||
        urlString.startsWith('https://www.google.com') ||
        urlString.startsWith('https://baidu.com/s?')) {
      throw new Error('Google/baidu search link');
    }

    if (urlString.includes('example.com')) {
      throw new Error('Example URL');
    }

    // Handle x.com and twitter.com URLs with /analytics
    if (options.removeXAnalytics) {
      const xComPattern = /^(https?:\/\/(www\.)?(x\.com|twitter\.com)\/([^/]+)\/status\/(\d+))\/analytics(\/)?(\?.*)?(#.*)?$/i;
      const xMatch = urlString.match(xComPattern);
      if (xMatch) {
        let cleanUrl = xMatch[1];
        if (xMatch[7]) cleanUrl += xMatch[7];
        if (xMatch[8]) cleanUrl += xMatch[8];
        urlString = cleanUrl;
      }
    }

    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Unsupported protocol');
    }

    url.hostname = url.hostname.toLowerCase();
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
    }

    if ((url.protocol === 'http:' && url.port === '80') ||
        (url.protocol === 'https:' && url.port === '443')) {
      url.port = '';
    }

    // Path normalization
    url.pathname = url.pathname
      .split('/')
      .map(segment => {
        try {
          return decodeURIComponent(segment);
        } catch (e) {
          if (debug) {
            console.log(`Failed to decode path segment: ${segment}`);
          }
          return segment;
        }
      })
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/\/+$/, '') || '/';

    // Query parameter normalization
    const searchParams = new URLSearchParams(url.search);
    const sortedParams = Array.from(searchParams.entries())
      .map(([key, value]) => {
        if (value === '') return [key, ''];
        try {
          const decodedValue = decodeURIComponent(value);
          if (encodeURIComponent(decodedValue) === value) {
            return [key, decodedValue];
          }
        } catch (e) {
          if (debug) {
            console.log(`Failed to decode query param ${key}=${value}`);
          }
        }
        return [key, value];
      })
      .filter(([key]) => {
        if (key === '') return false;

        // Remove session IDs
        if (options.removeSessionIDs &&
          /^(s|session|sid|sessionid|phpsessid|jsessionid|aspsessionid|asp\.net_sessionid)$/i.test(key)) {
          return false;
        }

        // Remove UTM parameters
        if (options.removeUTMParams && /^utm_/i.test(key)) {
          return false;
        }

        // Remove common tracking parameters
        if (options.removeTrackingParams &&
          /^(ref|referrer|fbclid|gclid|cid|mcid|source|medium|campaign|term|content|sc_rid|mc_[a-z]+)$/i.test(key)) {
          return false;
        }

        return true;
      })
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

    url.search = new URLSearchParams(sortedParams).toString();

    // Fragment (anchor) handling
    if (options.removeAnchors) {
      url.hash = '';
    } else if (url.hash === '#' || url.hash === '#top' || url.hash === '#/' || !url.hash) {
      url.hash = '';
    }

    let normalizedUrl = url.toString();

    // Remove trailing slash
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch (error) {
    console.warn(`Invalid URL "${urlString}": ${error}`);
    return;
  }
}

// Extract URLs from text with context
export function extractUrlsWithDescription(text: string, contextWindowSize = 50): SearchSnippet[] {
  const urlPattern = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

  const matches: Array<{ url: string; index: number; length: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(text)) !== null) {
    let url = match[0];
    let length = url.length;

    // Clean trailing punctuation
    if (/[.,;:!?)]$/.test(url)) {
      url = url.substring(0, url.length - 1);
      length = url.length;
      urlPattern.lastIndex = match.index + length;
    }

    matches.push({
      url,
      index: match.index,
      length
    });
  }

  if (matches.length === 0) {
    return [];
  }

  const results: SearchSnippet[] = [];

  for (let i = 0; i < matches.length; i++) {
    const { url, index, length } = matches[i];

    // Calculate context boundaries
    let startPos = Math.max(0, index - contextWindowSize);
    let endPos = Math.min(text.length, index + length + contextWindowSize);

    // Adjust for overlapping URLs
    if (i > 0) {
      const prevUrl = matches[i - 1];
      if (startPos < prevUrl.index + prevUrl.length) {
        startPos = prevUrl.index + prevUrl.length;
      }
    }

    if (i < matches.length - 1) {
      const nextUrl = matches[i + 1];
      if (endPos > nextUrl.index) {
        endPos = nextUrl.index;
      }
    }

    // Extract context
    const beforeText = text.substring(startPos, index);
    const afterText = text.substring(index + length, endPos);

    let description = '';
    if (beforeText && afterText) {
      description = `${beforeText.trim()} ... ${afterText.trim()}`;
    } else if (beforeText) {
      description = beforeText.trim();
    } else if (afterText) {
      description = afterText.trim();
    } else {
      description = 'No context available';
    }

    description = description.replace(/\s+/g, ' ').trim();

    results.push({
      url,
      description,
      title: ''
    });
  }

  return results;
}

// Helper function to extract hostname and path from a URL
const extractUrlParts = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    return {
      hostname: url.hostname.startsWith('www.') ? url.hostname.slice(4) : url.hostname,
      path: url.pathname
    };
  } catch (e) {
    console.error(`Error parsing URL: ${urlStr}`, e);
    return { hostname: "", path: "" };
  }
};

// Normalize hostname
export const normalizeHostName = (hostStr: string) => {
  const extract = extractUrlParts(hostStr);
  const host = extract.hostname;
  if (!host) {
    return hostStr.startsWith('www.') ? hostStr.slice(4).toLowerCase() : hostStr.toLowerCase();
  }
  return host;
};

// Sample from multinomial distribution
export function sampleMultinomial<T>(items: [T, number][]): T | null {
  if (!items || items.length === 0) {
    return null;
  }

  const totalWeight = items.reduce((sum, [, weight]) => sum + weight, 0);

  if (totalWeight === 0) {
    return null;
  }

  const randValue = Math.random() * totalWeight;

  let cumulativeWeight = 0;

  for (const [item, weight] of items) {
    cumulativeWeight += weight;
    if (randValue <= cumulativeWeight) {
      return item;
    }
  }

  return items[items.length - 1][0];
}