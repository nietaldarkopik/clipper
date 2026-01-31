import { FastifyInstance } from 'fastify';
import { getSettings, updateSettings } from '../lib/db';

export default async function settingsRoutes(fastify: FastifyInstance) {
  
  fastify.get('/settings', async (_request, _reply) => {
    return getSettings();
  });

  fastify.post('/settings', async (request, reply) => {
    const newSettings = request.body;
    if (!newSettings || typeof newSettings !== 'object') {
        return reply.code(400).send({ error: 'Invalid settings data' });
    }
    const updated = updateSettings(newSettings);
    return updated;
  });
}
