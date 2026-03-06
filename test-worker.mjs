import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';

const workerPath = './src/backend/lib/whisper.worker.mjs';
console.log('Checking worker at:', workerPath);

if (!fs.existsSync(workerPath)) {
    console.error('Worker file not found!');
    process.exit(1);
}

try {
    const worker = new Worker(workerPath);
    console.log('Worker created successfully.');
    
    worker.on('error', (err) => {
        console.error('Worker error:', err);
        process.exit(1);
    });

    worker.on('exit', (code) => {
        console.log('Worker exited with code:', code);
    });

    setTimeout(() => {
        console.log('Terminating worker...');
        worker.terminate();
    }, 1000);

} catch (e) {
    console.error('Failed to create worker:', e);
}
