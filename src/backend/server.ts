import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { startWorkers } from './workers';
import { initDB } from './lib/db';
import videoRoutes from './routes/video';
import libraryRoutes from './routes/library';
import researchRoutes from './routes/research';
import aiRoutes from './routes/ai';

const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: true
});

// Register Routes
fastify.register(videoRoutes);
fastify.register(libraryRoutes);
fastify.register(researchRoutes);
fastify.register(aiRoutes);

fastify.get('/', async (_request, _reply) => {
  return { status: 'ok', message: 'Video Clipper Backend Running' };
});

export const startServer = async () => {
  try {
    // Initialize Database
    initDB();

    // Start Redis Workers
    startWorkers();

    await fastify.listen({ port: 3000 });
    console.log('Backend server listening on port 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Start server if run directly
if (require.main === module) {
  startServer();
}
