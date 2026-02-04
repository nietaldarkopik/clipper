import { FastifyInstance } from 'fastify';
import { renderQueue } from '../queues';
import { v4 as uuidv4 } from 'uuid';

export default async function editorRoutes(fastify: FastifyInstance) {

    // POST /editor/render
    fastify.post('/editor/render', async (request, reply) => {
        const projectData = request.body as any;
        
        if (!projectData || !projectData.layers || !projectData.clips) {
            return reply.code(400).send({ error: 'Invalid project data' });
        }

        const id = uuidv4();
        
        // Add to render queue
        await renderQueue.add('render-project', { ...projectData, id }, { jobId: id });

        return { status: 'queued', jobId: id, message: 'Render started' };
    });
}
