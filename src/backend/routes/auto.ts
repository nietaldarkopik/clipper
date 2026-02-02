import { FastifyInstance } from 'fastify';
import { autoQueue } from '../queues';
import { v4 as uuidv4 } from 'uuid';

export default async function autoRoutes(fastify: FastifyInstance) {
    // POST /auto/run
    fastify.post('/run', async (request, reply) => {
        const { keyword, count = 3, platform = 'youtube', projectId } = request.body as {
            keyword?: string,
            count?: number,
            platform?: string,
            projectId?: string
        };

        const id = uuidv4();

        await autoQueue.add('auto-process', {
            keyword: keyword || 'trending indonesia',
            count,
            platform,
            projectId
        }, { jobId: id });

        return { status: 'queued', jobId: id, message: 'Auto process started' };
    });
}
