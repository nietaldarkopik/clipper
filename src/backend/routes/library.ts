import { FastifyInstance } from 'fastify';
import { getVideos, getVideo, deleteVideo, getClips, deleteClip, getTranscript } from '../lib/db';

export default async function libraryRoutes(fastify: FastifyInstance) {
  
  // Videos
  fastify.get('/library/videos', async (_request, reply) => {
    try {
      const videos = getVideos();
      return { videos };
    } catch (error) {
      console.error(error);
      return reply.code(500).send({ error: 'Failed to fetch videos' });
    }
  });

  fastify.get('/library/videos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const video = getVideo(id) as any;
    if (!video) return reply.code(404).send({ error: 'Video not found' });
    
    // Also fetch related clips
    const clips = getClips(id);
    return { ...video, clips };
  });

  fastify.delete('/library/videos/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      deleteVideo(id);
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to delete video' });
    }
  });

  // Clips
  fastify.get('/library/videos/:id/clips', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const clips = getClips(id);
    return { clips };
  });

  fastify.delete('/library/clips/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      deleteClip(id);
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to delete clip' });
    }
  });

  // Transcripts
  fastify.get('/library/videos/:id/transcript', async (request, reply) => {
    const { id } = request.params as { id: string };
    const transcript = getTranscript(id);
    if (!transcript) return reply.code(404).send({ error: 'Transcript not found' });
    return { transcript };
  });
}
