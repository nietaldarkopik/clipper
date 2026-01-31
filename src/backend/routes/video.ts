import { FastifyInstance } from 'fastify';
import path from 'path';
import { downloadQueue, analyzeQueue, processQueue, uploadQueue } from '../queues';
import { v4 as uuidv4 } from 'uuid';
import { cancelDownloadJob } from '../workers';
import { getSettings, getVideo, saveVideo, saveClip, deleteClip } from '../lib/db';

export default async function videoRoutes(fastify: FastifyInstance) {
  
  // POST /video/download
  fastify.post('/video/download', async (request, reply) => {
    const { url, projectId, downloadSubtitles } = request.body as { url: string, projectId?: string, downloadSubtitles?: boolean };
    if (!url) {
      return reply.code(400).send({ error: 'URL is required' });
    }

    const id = uuidv4();
    
    // Save initial video record with downloading status
    try {
        saveVideo({
            id,
            url,
            filepath: '', // Will be updated later
            source: 'youtube', // Assuming youtube for now, can be detected
            title: 'Downloading...',
            created_at: new Date().toISOString(),
            status: 'downloading',
            progress: 0,
            project_id: projectId // Associate with project if provided
        });
    } catch (e) {
        console.error('Failed to save initial video record:', e);
    }

    await downloadQueue.add('download-video', { url, id, projectId, downloadSubtitles }, { jobId: id });
    
    return { status: 'queued', jobId: id, message: 'Download started' };
  });

  // POST /video/download/:id/cancel
  fastify.post('/video/download/:id/cancel', async (request, _reply) => {
    const { id } = request.params as { id: string };
    
    // 1. Try to kill the active process
    cancelDownloadJob(id);
    
    // 2. Remove from queue if pending
    const job = await downloadQueue.getJob(id);
    if (job) {
        if (await job.isActive()) {
             // It might be killed by cancelDownloadJob, but we ensure it fails/stops
             await job.discard(); 
             // Ideally we should move it to failed or remove it?
             // Calling moveToFailed won't kill process, but we did that.
             await job.moveToFailed(new Error('Cancelled by user'), id);
        } else if (await job.isWaiting()) {
            await job.remove();
        }
    }

    // 3. Update DB status
    const video = getVideo(id);
    if (video) {
        saveVideo({ ...video, status: 'cancelled', progress: 0 });
    }

    return { success: true, message: 'Download cancelled' };
  });

  // POST /video/download/:id/retry
  fastify.post('/video/download/:id/retry', async (request, reply) => {
      const { id } = request.params as { id: string };
      const video = getVideo(id);
      
      if (!video || !video.url) {
          return reply.code(404).send({ error: 'Video not found or missing URL' });
      }

      // Reset status
      saveVideo({ ...video, status: 'downloading', progress: 0, title: 'Downloading...' });

      // Add to queue again
      // We might need to remove old job if it exists in failed state to reuse ID
      const oldJob = await downloadQueue.getJob(id);
      if (oldJob) {
          await oldJob.remove();
      }

      await downloadQueue.add('download-video', { url: video.url, id }, { jobId: id });
      
      return { status: 'queued', jobId: id, message: 'Download retried' };
  });

  // POST /video/upload
  fastify.post('/video/upload', async (request, reply) => {
    const { filePath, platform, metadata, projectId } = request.body as { filePath: string, platform: string, metadata: any, projectId?: string };
    
    if (!filePath) {
        return reply.code(400).send({ error: 'FilePath is required' });
    }

    // If projectId is provided, we treat this as "Add to Project" (Import)
    // We don't necessarily upload to a platform, but we register it in the DB
    
    const id = uuidv4();
    
    // Check if we are uploading to a platform or just importing to project
    // If platform is not provided, we assume local import
    
    if (projectId) {
         saveVideo({
            id,
            url: filePath, // Use file path as URL for local files
            filepath: filePath,
            source: 'local_upload',
            title: path.basename(filePath),
            created_at: new Date().toISOString(),
            status: 'completed', // Local files are ready immediately
            progress: 100,
            project_id: projectId
        });
        return { status: 'completed', jobId: id, message: 'Video imported to project' };
    }

    if (!platform) {
         return reply.code(400).send({ error: 'Platform is required for social upload' });
     }
     
     // ... existing upload logic for social media ...
 
     await uploadQueue.add('upload-video', { filePath, platform, metadata }, { jobId: id });
    return { status: 'queued', jobId: id, message: 'Upload started' };
  });

  // POST /video/analyze
  fastify.post('/video/analyze', async (request, reply) => {
    let { id, modelSize, method } = request.body as { id: string, modelSize?: string, method?: 'youtube' | 'whisper' | 'auto' };
    
    // Apply defaults from settings
    const settings = getSettings();
    
    if (!method) {
        method = settings.transcriptionMethod || 'auto';
    }
    
    if (!modelSize && method !== 'youtube') {
        modelSize = settings.whisperModel || 'tiny';
    }

    console.log(`[API] /video/analyze request received: id=${id}, modelSize=${modelSize}, method=${method}`);
    
    if (!id) {
        return reply.code(400).send({ error: 'Video ID is required' });
    }

    try {
        const job = await analyzeQueue.add('analyze-video', { id, modelSize, method });
        console.log(`[API] Analysis job queued: jobId=${job.id}`);
        return { status: 'queued', jobId: job.id, message: 'Analysis started' };
    } catch (error) {
        console.error(`[API] Failed to queue analysis job:`, error);
        return reply.code(500).send({ error: 'Failed to start analysis' });
    }
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

  // POST /editor/merge
  fastify.post('/editor/merge', async (request, reply) => {
      const { filePaths, projectId, outputName } = request.body as { filePaths: string[], projectId: string, outputName: string };
      
      if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
          return reply.code(400).send({ error: 'filePaths array is required' });
      }

      const job = await processQueue.add('merge-clips', { filePaths, projectId, outputName });
      return { status: 'queued', jobId: job.id, message: 'Merge started' };
  });

  // POST /editor/clips/batch
  fastify.post('/editor/clips/batch', async (request, reply) => {
      const { clips, videoId } = request.body as { clips: any[], videoId: string };
      
      if (!clips || !Array.isArray(clips) || !videoId) {
          return reply.code(400).send({ error: 'clips array and videoId are required' });
      }

      const savedClips = clips.map(clip => {
          const id = uuidv4();
          const newClip = {
              id,
              video_id: videoId,
              label: clip.title || 'Highlight',
              description: clip.description,
              start_time: clip.start_time,
              end_time: clip.end_time,
              created_at: new Date().toISOString()
          };
          saveClip(newClip);
          return newClip;
      });

      return { success: true, clips: savedClips };
  });

  // DELETE /editor/clips/:id
  fastify.delete('/editor/clips/:id', async (request, _reply) => {
      const { id } = request.params as { id: string };
      deleteClip(id);
      return { success: true };
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
      const data = job.data;

      return { id: jobId, state, progress, result, data };
  });
}
