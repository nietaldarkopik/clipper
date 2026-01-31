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

  fastify.post('/ai/generate-summary', async (request, reply) => {
    const { transcript } = request.body as { transcript: string };
    
    if (!transcript) {
      return reply.code(400).send({ error: 'Transcript is required' });
    }

    try {
      const aiService = getAIService();
      const summary = await aiService.generateSummary(transcript);
      return { summary };
    } catch (error: any) {
      console.error('AI Summary generation failed:', error);
      return reply.code(500).send({ 
        error: 'Failed to generate summary',
        details: error.message 
      });
    }
  });

  fastify.post('/ai/generate-script', async (request, reply) => {
    const { summary, style } = request.body as { summary: string, style?: string };
    
    if (!summary) {
      return reply.code(400).send({ error: 'Summary is required' });
    }

    try {
      const aiService = getAIService();
      const script = await aiService.generateScript(summary, style);
      return { script };
    } catch (error: any) {
      console.error('AI Script generation failed:', error);
      return reply.code(500).send({ 
        error: 'Failed to generate script',
        details: error.message 
      });
    }
  });

  fastify.post('/ai/generate-speech', async (request, reply) => {
    const { text, voice } = request.body as { text: string, voice?: string };
    
    if (!text) {
      return reply.code(400).send({ error: 'Text is required' });
    }

    try {
      const aiService = getAIService();
      const buffer = await aiService.generateSpeech(text, voice);
      
      // Return audio buffer directly or save to file and return url?
      // Returning buffer allows immediate playback.
      reply.header('Content-Type', 'audio/mpeg');
      return reply.send(buffer);
    } catch (error: any) {
      console.error('AI Speech generation failed:', error);
      return reply.code(500).send({ 
        error: 'Failed to generate speech',
        details: error.message 
      });
    }
  });

  fastify.post('/ai/generate-highlights', async (request, reply) => {
      const { transcript } = request.body as { transcript: string };
      if (!transcript) {
          return reply.code(400).send({ error: 'Transcript is required' });
      }
      try {
          const aiService = getAIService();
          const highlights = await aiService.getHighlightsFromTranscript(transcript);
          return { highlights };
      } catch (error: any) {
          console.error('AI Highlights generation failed:', error);
          return reply.code(500).send({ error: 'Failed to generate highlights' });
      }
  });
}
