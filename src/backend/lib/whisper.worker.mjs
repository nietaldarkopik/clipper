
import { pipeline, env } from '@xenova/transformers';
import { parentPort } from 'worker_threads';

// Skip local check to avoid FS errors in some environments
env.allowLocalModels = false;
env.useBrowserCache = false;

// Map simple model names to HuggingFace models
const modelMap = {
    'tiny': 'Xenova/whisper-tiny',
    'base': 'Xenova/whisper-base',
    'small': 'Xenova/whisper-small',
    'medium': 'Xenova/whisper-medium',
};

parentPort.on('message', async (message) => {
    const { audioData, modelSize } = message;
    
    try {
        const modelName = modelMap[modelSize] || modelMap['tiny'];
        
        // Initialize pipeline
        const transcriber = await pipeline('automatic-speech-recognition', modelName, {
            progress_callback: (data) => {
                 if (data.status === 'progress') {
                     // Loading model
                     const percent = Math.round((data.loaded / data.total) * 100);
                     parentPort.postMessage({ type: 'progress', value: Math.round(percent * 0.2) });
                 }
            }
        });

        const totalSeconds = audioData.length / 16000;

        const output = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true,
            callback_function: (item) => {
                 if (item) {
                     if (item.text) {
                          parentPort.postMessage({ type: 'partial', text: item.text });
                     }
                     if (item.timestamp && typeof item.timestamp[1] === 'number') {
                         const currentSeconds = item.timestamp[1];
                         const percent = Math.min(100, (currentSeconds / totalSeconds) * 100);
                         const mappedProgress = 30 + Math.round(percent * 0.69); 
                         parentPort.postMessage({ type: 'progress', value: mappedProgress });
                     }
                 }
            }
        });

        // Format result
        const segments = output.chunks ? output.chunks.map(chunk => ({
            start: chunk.timestamp[0],
            end: chunk.timestamp[1],
            text: chunk.text
        })) : [];

        if (segments.length === 0 && output.text) {
             segments.push({
                 start: 0,
                 end: totalSeconds || 0,
                 text: output.text
             });
        }

        parentPort.postMessage({ 
            type: 'result', 
            data: {
                text: output.text,
                segments: segments,
                language: 'auto'
            }
        });

    } catch (error) {
        parentPort.postMessage({ type: 'error', error: error.message });
    }
});
