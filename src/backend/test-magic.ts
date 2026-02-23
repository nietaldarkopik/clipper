
import { startServer } from './server';
import axios from 'axios';

async function testMagicLink() {
    console.log('Starting server...');
    // We can't await startServer() because it listens indefinitely if not careful, 
    // but startServer() in server.ts calls listen() which is async but doesn't block the event loop from processing if we don't await it forever? 
    // Wait, fastify.listen is async.
    
    // We'll run startServer and give it a moment.
    startServer();

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Server should be running.');

    const apiUrl = 'http://localhost:3000/api';
    const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Me at the zoo (short)

    try {
        console.log(`Sending Magic Request for ${testUrl}...`);
        const response = await axios.post(`${apiUrl}/magic/process`, {
            url: testUrl
        });

        console.log('Response:', response.data);
        const { jobs, batchId } = response.data;
        
        if (!jobs || jobs.length === 0) {
            console.error('No jobs returned!');
            process.exit(1);
        }

        const jobId = jobs[0].jobId;
        console.log(`Polling status for Job ${jobId}...`);

        // Poll for 30 seconds
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
                const statusRes = await axios.get(`${apiUrl}/magic/status/${jobId}`);
                const { state, progress, logs, error } = statusRes.data;
                
                console.log(`[${i}s] State: ${state}, Progress: ${progress}%`);
                if (logs) {
                    const lastLog = logs.split('\n').pop();
                    console.log(`      Last Log: ${lastLog}`);
                }

                if (state === 'completed') {
                    console.log('Job Completed!');
                    console.log('Result:', statusRes.data.result);
                    process.exit(0);
                }

                if (state === 'failed') {
                    console.log('Job Failed!');
                    console.error('Error:', error);
                    console.log('Logs:\n', logs);
                    process.exit(1);
                }

            } catch (err: any) {
                console.error('Polling Error:', err.message);
            }
        }

        console.log('Timeout waiting for job completion.');
        process.exit(1);

    } catch (error: any) {
        console.error('Test Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
        process.exit(1);
    }
}

testMagicLink();
