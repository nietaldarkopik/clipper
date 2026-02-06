import { FastifyInstance } from 'fastify';
import { autoQueue } from '../queues';
import { v4 as uuidv4 } from 'uuid';
import ytDlp from 'yt-dlp-exec';
import { scrapeSearch } from '../lib/web-scraper';

export default async function autoRoutes(fastify: FastifyInstance) {
    fastify.post('/search', async (request, reply) => {
        const { keyword, count = 3, platform = 'youtube' } = request.body as {
            keyword?: string,
            count?: number,
            platform?: string
        };

        if (!keyword) {
            return reply.code(400).send({ error: 'keyword is required' });
        }

        try {
            if (platform === 'youtube') {
                const output = await ytDlp(`ytsearch${count}:${keyword}`, {
                    dumpSingleJson: true,
                    noWarnings: true,
                    flatPlaylist: true,
                    noCheckCertificate: true
                });
                const entries = (output as any).entries || [];
                const results = entries.map((entry: any) => ({
                    id: entry.id,
                    title: entry.title,
                    thumbnail: entry.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
                    url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                    duration: entry.duration,
                    fileSize: entry.filesize || entry.filesize_approx,
                    channelName: entry.uploader || entry.channel,
                    channelUrl: entry.uploader_url || entry.channel_url,
                    channelThumbnail: entry.uploader_thumbnail || entry.channel_thumbnail || entry.uploader_avatar || entry.channel_avatar,
                    source: platform
                }));
                return { results };
            }

            const links = await scrapeSearch(keyword, platform, count);
            const results = links.map(link => ({
                id: link.url,
                title: link.title,
                url: link.url,
                thumbnail: '',
                source: platform
            }));
            return { results };
        } catch (error: any) {
            console.error('Auto search failed:', error);
            return reply.code(500).send({ error: 'Auto search failed' });
        }
    });

    // POST /auto/run
    fastify.post('/run', async (request, reply) => {
        const { keyword, count = 3, platform = 'youtube', projectId, selectedVideos } = request.body as {
            keyword?: string,
            count?: number,
            platform?: string,
            projectId?: string,
            selectedVideos?: Array<{ id?: string, title?: string, url: string }>
        };

        const id = uuidv4();

        await autoQueue.add('auto-process', {
            keyword: keyword || 'trending indonesia',
            count,
            platform,
            projectId,
            selectedVideos
        }, { jobId: id });

        return { status: 'queued', jobId: id, message: 'Auto process started' };
    });
}
