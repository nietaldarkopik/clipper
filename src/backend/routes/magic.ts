import { FastifyInstance } from 'fastify';
import { magicQueue } from '../queues';
import { v4 as uuidv4 } from 'uuid';

export default async function magicRoutes(fastify: FastifyInstance) {

    // POST /magic/process
    fastify.post('/magic/process', async (request, reply) => {
        const { url, urls } = request.body as { url?: string, urls?: string[] };
        
        let targetUrls: string[] = [];
        if (urls && Array.isArray(urls)) {
            targetUrls = urls;
        } else if (url) {
            targetUrls = [url];
        }

        if (targetUrls.length === 0) {
            return reply.code(400).send({ error: 'URL(s) are required' });
        }

        const batchId = uuidv4();
        const jobs = [];

        for (const targetUrl of targetUrls) {
            const jobId = uuidv4();
            await magicQueue.add('magic-process', {
                url: targetUrl,
                batchId,
                jobId
            }, {
                jobId,
                priority: 1 // Higher priority
            });
            jobs.push({ jobId, url: targetUrl });
        }

        return { 
            status: 'queued', 
            batchId, 
            jobs,
            message: `Batch processing started for ${jobs.length} videos` 
        };
    });

    // GET /magic/batch/:batchId
    fastify.get('/magic/batch/:batchId', async (request) => {
        const { batchId } = request.params as { batchId: string };
        return {
            batchId,
            message: "Please poll individual job statuses using /magic/status/:jobId"
        };
    });

    // GET /magic/status/:jobId
    fastify.get('/magic/status/:jobId', async (request, reply) => {
        const { jobId } = request.params as { jobId: string };
        
        const job = await magicQueue.getJob(jobId);
        if (!job) {
            return reply.code(404).send({ error: 'Job not found' });
        }

        const state = await job.getState();
        const progress = job.progress;
        const data = job.data;
        const returnvalue = job.returnvalue;
        const failedReason = job.failedReason;

        return {
            jobId,
            state,
            progress,
            logs: data.logs || '', // Return accumulated logs
            result: returnvalue,
            error: failedReason
        };
    });
}
