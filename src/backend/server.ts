import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import path from 'path';
import fastifyStatic from '@fastify/static';
import { startWorkers } from './workers';
import { initDB } from './lib/db';
import videoRoutes from './routes/video';
import libraryRoutes from './routes/library';
import researchRoutes from './routes/research';
import aiRoutes from './routes/ai';
import channelsRoutes from './routes/channels';
import projectRoutes from './routes/projects';

const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: true
});

// Register Routes
// Force reload
fastify.register(videoRoutes, { prefix: '/api' });
fastify.register(libraryRoutes, { prefix: '/api' });
fastify.register(researchRoutes, { prefix: '/api' });
fastify.register(aiRoutes, { prefix: '/api' });
fastify.register(channelsRoutes, { prefix: '/api' });
fastify.register(projectRoutes, { prefix: '/api' });

// Serve Static Files (Frontend)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../dist/renderer'),
  prefix: '/',
  // Don't throw 404 immediately, let setNotFoundHandler handle it for SPA
  wildcard: false 
});

fastify.get('/api/health', async (_request, _reply) => {
  return { status: 'ok', message: 'Video Clipper Backend Running' };
});

// SPA Catch-all
fastify.setNotFoundHandler(async (request, reply) => {
    // If it's an API call (JSON) or explicit API route, return 404
    // Otherwise try to serve index.html for client-side routing
    if (request.headers.accept?.includes('text/html') && !request.url.startsWith('/api')) {
         return reply.sendFile('index.html');
    }
    reply.status(404).send({ error: 'Not Found', message: `Route ${request.url} not found` });
});

export const startServer = async () => {
  try {
    // Initialize Database
    initDB();

    // Start Redis Workers
    startWorkers();

    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port: PORT, host: HOST });
    // Backend server listening
    console.log(`Backend server listening on port ${PORT} at ${HOST}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Start server if run directly
if (require.main === module) {
  startServer();
}
