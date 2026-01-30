import axios from 'axios';
import * as cheerio from 'cheerio';
// @ts-ignore
import UserAgent from 'user-agents';

interface SearchResult {
  url: string;
  title: string;
}

export const scrapeSearch = async (query: string, source: string, count: number = 10): Promise<SearchResult[]> => {
  const targetSite = getTargetSite(source);
  const fullQuery = `site:${targetSite} ${query}`;
  
  // Try DuckDuckGo first (HTML version)
  try {
    return await scrapeDuckDuckGo(fullQuery, count);
  } catch (error) {
    console.error('DDG Scrape failed, trying Bing fallback...');
    // Fallback to Bing
    try {
      return await scrapeBing(fullQuery, count);
    } catch (bingError) {
      console.error('Bing Scrape failed, trying Google fallback...');
      // Fallback to Google (very basic, might be blocked)
      return await scrapeGoogle(fullQuery, count);
    }
  }
};

const getTargetSite = (source: string): string => {
  switch (source) {
    case 'tiktok': return 'tiktok.com';
    case 'instagram': return 'instagram.com';
    case 'twitter': return 'twitter.com';
    case 'facebook': return 'facebook.com';
    default: return 'youtube.com';
  }
};

const scrapeBing = async (query: string, limit: number): Promise<SearchResult[]> => {
  const userAgent = new UserAgent();
  const response = await axios.get('https://www.bing.com/search', {
    params: { q: query, count: limit + 5 },
    headers: {
      'User-Agent': userAgent.toString(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    timeout: 5000
  });

  const $ = cheerio.load(response.data);
  const results: SearchResult[] = [];

  $('.b_algo h2 a').each((_i, el) => {
    if (results.length >= limit) return;
    const url = $(el).attr('href');
    const title = $(el).text();
    if (url && title && url.startsWith('http')) {
      results.push({ url, title });
    }
  });

  if (results.length === 0) throw new Error("No results from Bing");
  return results;
};

const scrapeDuckDuckGo = async (query: string, limit: number): Promise<SearchResult[]> => {
  const userAgent = new UserAgent();
  const response = await axios.get('https://html.duckduckgo.com/html/', {
    params: { q: query },
    headers: {
      'User-Agent': userAgent.toString(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://html.duckduckgo.com/'
    },
    timeout: 5000
  });

  const $ = cheerio.load(response.data);
  const results: SearchResult[] = [];

  $('.result__a').each((_i, el) => {
    if (results.length >= limit) return;
    const url = $(el).attr('href');
    const title = $(el).text();
    if (url && title) {
      // DDG redirects, need to extract real URL if it's a "uddg" link?
      // Actually DDG html often gives direct links or wrapped ones.
      // Usually it's like //duckduckgo.com/l/?kh=-1&uddg=...
      // But let's check if we get direct or need decoding.
      // For simplicity, we just check if it contains the target domain.
      
      // Basic decoding if it's a DDG wrapper
      let realUrl = url;
      if (url.includes('uddg=')) {
        const match = url.match(/uddg=([^&]+)/);
        if (match && match[1]) {
          realUrl = decodeURIComponent(match[1]);
        }
      }

      results.push({ url: realUrl, title });
    }
  });

  return results;
};

const scrapeGoogle = async (query: string, limit: number): Promise<SearchResult[]> => {
  const userAgent = new UserAgent();
  // Note: Google scraping is brittle and often blocked without proxies.
  // This is a best-effort implementation.
  const response = await axios.get('https://www.google.com/search', {
    params: { q: query, num: limit + 5 }, // request a few more
    headers: {
      'User-Agent': userAgent.toString(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
  });

  const $ = cheerio.load(response.data);
  const results: SearchResult[] = [];

  // Google selectors change often. Common ones: .g a, .yuRUbf a
  $('a').each((_i, el) => {
    if (results.length >= limit) return;
    const url = $(el).attr('href');
    const title = $(el).find('h3').text(); // Google titles are often in h3

    if (url && url.startsWith('http') && !url.includes('google.com')) {
      // Filter out google internal links
      if (title) {
        results.push({ url, title });
      }
    } else if (url && url.startsWith('/url?q=')) {
        // Old mobile/basic google format
        const realUrl = url.split('/url?q=')[1]?.split('&')[0];
        if (realUrl && title) {
            results.push({ url: decodeURIComponent(realUrl), title });
        }
    }
  });

  return results;
};
