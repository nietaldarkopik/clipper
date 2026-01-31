
import { FastifyInstance } from 'fastify';
import { getProjects, getProject, saveProject, deleteProject, getVideos, getDB, saveVideo, getVideo } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';

export default async function projectRoutes(fastify: FastifyInstance) {
  
  // GET /projects
  fastify.get('/projects', async (_request, _reply) => {
    return getProjects();
  });

  // GET /projects/:id
  fastify.get('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    
    // Enrich with videos
    const videos = getVideos().filter((v: any) => v.project_id === id);
    const videoIds = new Set(videos.map((v: any) => v.id));
    
    // Enrich with clips
    const allClips = getDB().clips || [];
    const clips = allClips.filter((c: any) => videoIds.has(c.video_id));

    return { ...project, videos, clips };
  });

  // POST /projects
  fastify.post('/projects', async (request, reply) => {
    const { name, description } = request.body as { name: string, description?: string };
    if (!name) return reply.code(400).send({ error: 'Name is required' });

    const id = uuidv4();
    // Create project folder
    const projectDir = path.join(process.cwd(), 'projects', id);
    await fs.ensureDir(projectDir);

    const project = {
        id,
        name,
        description,
        path: projectDir,
        created_at: new Date().toISOString()
    };
    
    saveProject(project);
    return project;
  });

  // DELETE /projects/:id
  fastify.delete('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });

    // Optional: Remove folder
    if (project.path && await fs.pathExists(project.path)) {
        // await fs.remove(project.path); // Use with caution
    }

    deleteProject(id);
    return { success: true };
  });

  // POST /projects/:id/videos/add
  fastify.post('/projects/:id/videos/add', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { videoId } = request.body as { videoId: string };
    
    const project = getProject(id);
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    
    const video = getVideo(videoId) as any;
    if (!video) return reply.code(404).send({ error: 'Video not found' });
    
    // Update video with project_id
    saveVideo({ ...video, project_id: id });
    
    return { success: true };
  });
}
