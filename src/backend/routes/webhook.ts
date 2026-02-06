import { FastifyInstance } from 'fastify';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = util.promisify(exec);

export default async function webhookRoutes(fastify: FastifyInstance) {
  // GET endpoint for easy testing/verification
  fastify.get('/webhook/deploy', async (request, reply) => {
    return reply.send({ 
      status: 'ok', 
      message: 'Webhook endpoint is active. Please use POST request with valid token and payload to trigger deployment.' 
    });
  });

  // Generic deploy webhook that supports both Gitea and GitHub
  fastify.post('/webhook/deploy', async (request, reply) => {
    const giteaEvent = request.headers['x-gitea-event'];
    const githubEvent = request.headers['x-github-event'];
    const event = giteaEvent || githubEvent;
    
    // Simple secret validation if configured
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      // Note: Real Gitea signature verification involves HMAC-SHA256
      // For simplicity, we can also check a custom header or just rely on the payload if trusted network
      // But typically Gitea sends a signature. 
      // If the user just wants a simple "secret token" in the URL or header, we can do that.
      // However, usually Gitea webhooks have a "Secret" field which is used to generate the signature.
      
      // For this implementation, we will assume the user might simply put the secret in the URL 
      // or we can implement proper HMAC check if needed.
      // Let's implement a basic check: if WEBHOOK_SECRET is set, we expect it in the query `?token=SECRET`
      // or we can try to verify the signature. 
      
      // Let's go with the query param for simplicity and robustness across different webhook providers if they switch,
      // but strictly for Gitea, let's try to be compliant.
      // Actually, standard Gitea webhook sends `X-Gitea-Signature`.
      // Let's just check a query param `token` for now to be safe and easy to configure.
      
      const { token } = request.query as { token?: string };
      if (token !== webhookSecret) {
        return reply.code(401).send({ error: 'Invalid token' });
      }
    }

    if (event !== 'push') {
      return reply.send({ status: 'ignored', message: 'Not a push event' });
    }

    // Branch validation
    const targetBranch = process.env.WEBHOOK_BRANCH || 'main';
    const body = request.body as { ref?: string };
    const pushedRef = body.ref;

    if (pushedRef && !pushedRef.endsWith(`/${targetBranch}`)) {
      return reply.send({ status: 'ignored', message: `Ignored push to ${pushedRef}, expecting ${targetBranch}` });
    }

    // Trigger build in background
    // We don't await this because it might take a long time and timeout the webhook request
    runBuildProcess();

    return reply.send({ status: 'ok', message: 'Build process started' });
  });
}

async function runBuildProcess() {
  console.log('[WEBHOOK] Starting build process...');
  const dbPath = path.join(process.cwd(), 'data', 'db.json');
  const backupPath = path.join(process.cwd(), 'data', 'db.json.backup');

  try {
    // 1. Backup database
    if (await fs.pathExists(dbPath)) {
        console.log('[WEBHOOK] Backing up database...');
        await fs.copy(dbPath, backupPath, { overwrite: true });
    }

    // 2. Git Stash (to save local changes if any)
    console.log('[WEBHOOK] Stashing local changes...');
    try {
        await execAsync('git stash');
    } catch (e) {
        console.log('[WEBHOOK] Git stash warning (might be empty/ignored):', e);
    }

    // 3. Git Pull
    console.log('[WEBHOOK] Git pulling...');
    await execAsync('git pull');
    
    // 4. Restore database
    if (await fs.pathExists(backupPath)) {
        console.log('[WEBHOOK] Restoring database...');
        await fs.copy(backupPath, dbPath, { overwrite: true });
    }
    
    // 5. NPM Install
    console.log('[WEBHOOK] NPM installing...');
    await execAsync('npm install');
    
    // 6. Build (Backend + Frontend)
    console.log('[WEBHOOK] Building...');
    // Using build:web as it seems to be the one for server deployment (excludes electron-builder)
    await execAsync('npm run build:web');
    
    console.log('[WEBHOOK] Build completed successfully.');
    
    // Optional: Restart service if using PM2
    // await execAsync('pm2 reload all'); 
    
  } catch (error) {
    console.error('[WEBHOOK] Build failed:', error);
  }
}
