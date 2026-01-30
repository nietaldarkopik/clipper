import { FastifyInstance } from 'fastify';
import { downloadQueue, analyzeQueue, processQueue, uploadQueue } from '../queues';
import { v4 as uuidv4 } from 'uuid';

export default async function videoRoutes(fastify: FastifyInstance) {
  
  // POST /video/download
  fastify.post('/video/download', async (request, reply) => {
    const { url } = request.body as { url: string };
    if (!url) {
      return reply.code(400).send({ error: 'URL is required' });
    }

    const id = uuidv4();
    await downloadQueue.add('download-video', { url, id }, { jobId: id });
    
    return { status: 'queued', jobId: id, message: 'Download started' };
  });

  // POST /video/upload
  fastify.post('/video/upload', async (request, reply) => {
    const { filePath, platform, metadata } = request.body as { filePath: string, platform: string, metadata: any };
    
    if (!filePath || !platform) {
        return reply.code(400).send({ error: 'FilePath and Platform are required' });
    }

    const id = uuidv4();
    await uploadQueue.add('upload-video', { filePath, platform, metadata }, { jobId: id });
    return { status: 'queued', jobId: id, message: 'Upload started' };
  });

  // POST /video/analyze
  fastify.post('/video/analyze', async (request, reply) => {
    const { id } = request.body as { id: string };
    if (!id) {
        return reply.code(400).send({ error: 'Video ID is required' });
    }

    const job = await analyzeQueue.add('analyze-video', { id });
    return { status: 'queued', jobId: job.id, message: 'Analysis started' };
  });

  // POST /editor/clip
  fastify.post('/editor/clip', async (request, reply) => {
      const { id, startTime, duration } = request.body as { id: string, startTime: number, duration: number };
      
      if (!id || startTime === undefined || !duration) {
          return reply.code(400).send({ error: 'Missing parameters' });
      }

      const job = await processQueue.add('process-clip', { id, startTime, duration });
      return { status: 'queued', jobId: job.id, message: 'Clipping started' };
  });

  // GET /dashboard/status (Simple status check for a job)
  fastify.get('/dashboard/status/:queueName/:jobId', async (request, reply) => {
      const { queueName, jobId } = request.params as { queueName: string, jobId: string };
      
      let queue;
      if (queueName === 'download') queue = downloadQueue;
      else if (queueName === 'analyze') queue = analyzeQueue;
      else if (queueName === 'process') queue = processQueue;
      else if (queueName === 'upload') queue = uploadQueue;
      else return reply.code(400).send({ error: 'Invalid queue name' });

      const job = await queue.getJob(jobId);
      if (!job) {
          return reply.code(404).send({ error: 'Job not found' });
      }

      const state = await job.getState();
      const result = job.returnvalue;
      const progress = job.progress;

      return { id: jobId, state, progress, result };
  });
}
