import { FastifyInstance } from 'fastify';
import { getChannels, saveChannel, deleteChannel } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import ytDlp from 'yt-dlp-exec';

export default async function channelsRoutes(fastify: FastifyInstance) {
  fastify.get('/channels', async () => {
    return getChannels();
  });

  fastify.post('/channels', async (request, reply) => {
    const data = request.body as any;
    if (!data.name || !data.platform || !data.url) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    const channel = {
      id: data.id || uuidv4(),
      name: data.name,
      platform: data.platform, // youtube, tiktok, instagram, facebook
      url: data.url,
      description: data.description || '',
    };

    saveChannel(channel);
    return channel;
  });

  fastify.delete('/channels/:id', async (request) => {
    const { id } = request.params as any;
    const result = deleteChannel(id);
    return result;
  });

  // Scrape videos from a channel
  fastify.get('/channels/:id/videos', async (request, reply) => {
    const { id } = request.params as any;
    const { limit = 10 } = request.query as any;
    
    const channels = getChannels();
    const channel = channels.find((c: any) => c.id === id);

    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }

    try {
      // YouTube specific handling to get videos, shorts, and streams
      if (channel.platform === 'youtube') {
        const scrapeSection = async (section: string, typeLabel: string) => {
          try {
            // Remove trailing slash if present
            const baseUrl = channel.url.replace(/\/$/, '');
            const url = section ? `${baseUrl}/${section}` : baseUrl;
            
            const output = await ytDlp(url, {
              dumpSingleJson: true,
              noWarnings: true,
              flatPlaylist: true,
              noCheckCertificate: true,
              playlistEnd: parseInt(limit)
            });

            const entries = (output as any).entries || [];
            return entries
              .filter((entry: any) => {
                if (!entry) return false;
                if (entry._type === 'playlist' || entry._type === 'channel') return false;
                // YouTube ID validation
                if (entry.id && (entry.id.startsWith('UC') || entry.id.length !== 11)) return false;
                return true;
              })
              .map((entry: any) => ({
                id: entry.id,
                title: entry.title,
                thumbnail: entry.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
                views: entry.view_count,
                duration: entry.duration,
                url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                uploader: entry.uploader || channel.name,
                source: channel.platform,
                type: typeLabel
              }));
          } catch (error) {
            console.warn(`Failed to scrape ${section} for ${channel.name}:`, error);
            return [];
          }
        };

        const [videos, shorts, streams] = await Promise.all([
          scrapeSection('videos', 'video'),
          scrapeSection('shorts', 'short'),
          scrapeSection('streams', 'live')
        ]);

        return [...videos, ...shorts, ...streams];
      }

      // Default handling for other platforms
      const output = await ytDlp(channel.url, {
        dumpSingleJson: true,
        noWarnings: true,
        flatPlaylist: true,
        noCheckCertificate: true,
        playlistEnd: parseInt(limit)
      });

      const entries = (output as any).entries || [];
      return entries
        .filter((entry: any) => {
          if (!entry) return false;
          // Filter out playlists/channels being returned as entries
          if (entry._type === 'playlist' || entry._type === 'channel') return false;
          return true;
        })
        .map((entry: any) => ({
          id: entry.id,
          title: entry.title,
          thumbnail: entry.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
          views: entry.view_count,
          duration: entry.duration,
          url: entry.url || entry.webpage_url,
          uploader: entry.uploader || channel.name,
          source: channel.platform,
          type: 'video' // Default type
        }));
    } catch (error) {
      console.error('Channel scrape failed:', error);
      // If simple scrape fails (common with some platforms), try to return empty or specific error
      return reply.code(500).send({ error: 'Failed to scrape channel. Platform might be blocking automated access.' });
    }
  });
}
