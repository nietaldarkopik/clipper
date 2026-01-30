import { FastifyInstance } from 'fastify';
import { getAIService } from '../lib/ai-service';

export default async function aiRoutes(fastify: FastifyInstance) {
  
  fastify.post('/ai/generate-metadata', async (request, reply) => {
    const { context } = request.body as { context: string };
    
    if (!context) {
      return reply.code(400).send({ error: 'Context is required' });
    }

    try {
      const aiService = getAIService();
      const metadata = await aiService.generateMetadata(context);
      return metadata;
    } catch (error: any) {
      console.error('AI Metadata generation failed:', error);
      return reply.code(500).send({ 
        error: 'Failed to generate metadata',
        details: error.message 
      });
    }
  });
}
