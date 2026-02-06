import { FastifyInstance } from 'fastify';
import ytDlp from 'yt-dlp-exec';
import { scrapeSearch } from '../lib/web-scraper';
import OpenAI from 'openai';
import crypto from 'crypto';
import { getSettings } from '../lib/db';

export default async function researchRoutes(fastify: FastifyInstance) {

  const getNotebookLmConfig = () => {
    const projectNumber = process.env.NOTEBOOKLM_PROJECT_NUMBER;
    const location = process.env.NOTEBOOKLM_LOCATION || 'global';
    const endpointLocation = process.env.NOTEBOOKLM_ENDPOINT_LOCATION || location;
    const accessToken = process.env.NOTEBOOKLM_ACCESS_TOKEN;
    if (!projectNumber || !accessToken) {
      throw new Error('NotebookLM configuration missing');
    }
    return { projectNumber, location, endpointLocation, accessToken };
  };

  const notebooklmRequest = async (path: string, method: string, body?: any) => {
    const { projectNumber, location, endpointLocation, accessToken } = getNotebookLmConfig();
    const baseUrl = `https://${endpointLocation}-discoveryengine.googleapis.com/v1alpha/projects/${projectNumber}/locations/${location}`;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'NotebookLM request failed');
    }
    return response.json();
  };

  const createNotebook = async (title: string) => {
    const result = await notebooklmRequest('/notebooks', 'POST', { title });
    return { notebookId: result.notebookId as string };
  };

  const addNotebookSources = async (notebookId: string, sources: Array<{ url: string; title?: string }>) => {
    const userContents = sources.map(source => {
      const isYoutube = source.url.includes('youtube.com') || source.url.includes('youtu.be');
      if (isYoutube) {
        return { videoContent: { url: source.url } };
      }
      return { webContent: { url: source.url, sourceName: source.title || source.url } };
    });
    return notebooklmRequest(`/notebooks/${notebookId}/sources:batchCreate`, 'POST', { userContents });
  };

  const buildNotebookUrl = (notebookId: string) => {
    const { projectNumber, location } = getNotebookLmConfig();
    return `https://notebooklm.cloud.google.com/${location}/notebook/${notebookId}?project=${projectNumber}`;
  };

  const generateChatGptResearch = async (query: string, limit: number) => {
    const settings = getSettings();
    const apiKey = process.env.OPENAI_API_KEY || settings.openaiApiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key missing');
    }
    const client = new OpenAI({ apiKey });
    const prompt = `
      You are a research assistant. Create ${Math.min(limit, 12)} research items based on the query: "${query}".
      Return ONLY a JSON object with a key "results" containing an array of objects with keys:
      - title (string)
      - summary (string, 2-3 sentences)
      - keywords (array of 3-6 strings)
    `;
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.6
    });
    const content = response.choices[0].message.content || '';
    const parsed = JSON.parse(content);
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    return results.map((item: any) => ({
      id: crypto.randomUUID(),
      title: item.title || 'Untitled',
      summary: item.summary || '',
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      source: 'chatgpt'
    }));
  };

  const generateDeepSeekResearch = async (query: string, limit: number) => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DeepSeek API key missing');
    }
    const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
    const prompt = `
      You are a research assistant. Create ${Math.min(limit, 12)} research items based on the query: "${query}".
      Return ONLY a JSON object with a key "results" containing an array of objects with keys:
      - title (string)
      - summary (string, 2-3 sentences)
      - keywords (array of 3-6 strings)
    `;
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.6
    });
    const content = response.choices[0].message.content || '';
    const parsed = JSON.parse(content);
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    return results.map((item: any) => ({
      id: crypto.randomUUID(),
      title: item.title || 'Untitled',
      summary: item.summary || '',
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      source: 'deepseek'
    }));
  };
  
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
      } else if (source === 'notebooklm') {
        results = [];
      } else if (source === 'chatgpt') {
        results = [];
      } else if (source === 'deepseek') {
        results = [];
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
      } else if (source === 'notebooklm') {
        const notebookTitle = `Research: ${query}`;
        const { notebookId } = await createNotebook(notebookTitle);
        const isUrl = query.match(/^(http|https|www)/);
        if (isUrl) {
          await addNotebookSources(notebookId, [{ url: query, title: query }]);
        } else {
          const sources = await fetchFromYoutube(query, 1, Math.min(limit, 12));
          const sourceList = sources.map(item => ({ url: item.url, title: item.title }));
          if (sourceList.length > 0) {
            await addNotebookSources(notebookId, sourceList);
          }
        }
        results = [{
          id: notebookId,
          title: notebookTitle,
          url: buildNotebookUrl(notebookId),
          source: 'notebooklm',
          uploader: 'NotebookLM',
          views: undefined,
          duration: undefined
        }];
      } else if (source === 'chatgpt') {
        results = await generateChatGptResearch(query, limit);
      } else if (source === 'deepseek') {
        results = await generateDeepSeekResearch(query, limit);
      } else {
        results = await fetchFromWeb(query, source, page, limit);
      }

      return { results, page, limit, source };
    } catch (error: any) {
      console.error('Search failed:', error);
      if (error?.message?.includes('NotebookLM configuration missing')) {
        return reply.code(400).send({ error: 'NotebookLM configuration missing' });
      }
      if (error?.message?.includes('OpenAI API key missing')) {
        return reply.code(400).send({ error: 'OpenAI API key missing' });
      }
      if (error?.message?.includes('DeepSeek API key missing')) {
        return reply.code(400).send({ error: 'DeepSeek API key missing' });
      }
      return reply.code(500).send({ error: 'Search failed' });
    }
  });
}
