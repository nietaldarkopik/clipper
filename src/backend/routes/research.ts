import { FastifyInstance } from 'fastify';
import ytDlp from 'yt-dlp-exec';
import { scrapeSearch } from '../lib/web-scraper';

export default async function researchRoutes(fastify: FastifyInstance) {
  
  const fetchFromYoutube = async (query: string, page: number, limit: number) => {
    const output = await ytDlp(`ytsearch${limit * 2}:${query}`, {
      dumpSingleJson: true,
      noWarnings: true,
      flatPlaylist: true,
      noCheckCertificate: true,
      playlistStart: (page - 1) * limit + 1,
      playlistEnd: page * limit
    });

    const entries = (output as any).entries || [];
    return entries.map((entry: any) => ({
      id: entry.id,
      title: entry.title,
      thumbnail: entry.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
      views: entry.view_count,
      duration: entry.duration,
      url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
      uploader: entry.uploader,
      source: 'youtube'
    }));
  };

  const fetchFromWeb = async (query: string, source: string, page: number, limit: number) => {
    // 1. Scrape URLs from Search Engine
    // We need to fetch enough items to cover the requested page
    const totalNeeded = page * limit;
    const links = await scrapeSearch(query, source, totalNeeded);
    
    if (links.length === 0) return [];

    // Slice for pagination
    const startIndex = (page - 1) * limit;
    const targetLinks = links.slice(startIndex, startIndex + limit);
    
    if (targetLinks.length === 0) return [];

    // 2. Enrich with yt-dlp metadata (parallel with concurrency limit)
    const results = await Promise.all(targetLinks.map(async (link) => {
      try {
        // Quick metadata fetch
        const info = await ytDlp(link.url, {
          dumpSingleJson: true,
          noWarnings: true,
          noCheckCertificate: true,
          skipDownload: true
        });
        
        return {
          id: (info as any).id,
          title: (info as any).title || link.title,
          thumbnail: (info as any).thumbnail || '',
          views: (info as any).view_count,
          duration: (info as any).duration,
          url: (info as any).webpage_url || link.url,
          uploader: (info as any).uploader,
          source: source
        };
      } catch (e) {
        // Fallback if yt-dlp fails or is not supported for this URL
        return {
          id: link.url, // Use URL as ID
          title: link.title,
          thumbnail: '', // Placeholder could be added in frontend
          url: link.url,
          source: source,
          isFallback: true
        };
      }
    }));

    return results;
  };

  // GET /research/trending
  fastify.get('/research/trending', async (request, _reply) => {
    const { page = 1, limit = 6, source = 'youtube' } = request.query as { page?: number; limit?: number; source?: string };
    
    try {
      let results = [];
      
      if (source === 'youtube') {
        results = await fetchFromYoutube('viral trending video 2025', page, limit);
      } else {
        // For other platforms, we search for trending keywords
        const trendingQuery = `viral trending ${source} videos 2025`;
        // Web scraper doesn't support pagination effectively (it's a hack), so we just fetch fresh
        results = await fetchFromWeb(trendingQuery, source, page, limit);
      }

      return { results, page, limit, source };
    } catch (error) {
      console.error('Trending search failed:', error);
      return { 
        results: [],
        error: 'Failed to fetch trending videos'
      };
    }
  });

  // POST /research/search
  fastify.post('/research/search', async (request, reply) => {
    const { query, page = 1, limit = 6, source = 'youtube' } = request.body as { query: string; page?: number; limit?: number; source?: string };
    if (!query) {
      return reply.code(400).send({ error: 'Query is required' });
    }

    try {
      let results = [];
      
      if (source === 'youtube') {
        results = await fetchFromYoutube(query, page, limit);
      } else {
        results = await fetchFromWeb(query, source, page, limit);
      }

      return { results, page, limit, source };
    } catch (error) {
      console.error('Search failed:', error);
      return reply.code(500).send({ error: 'Search failed' });
    }
  });
}
