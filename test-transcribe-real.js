
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

function readAudio(filePath) {
    console.log('Reading audio with ffmpeg...', filePath);
    return new Promise((resolve, reject) => {
        const buffers = [];
        ffmpeg(filePath)
            .toFormat('f32le')
            .audioChannels(1)
            .audioFrequency(16000)
            .on('error', (err) => {
                console.error('ffmpeg error:', err);
                reject(err);
            })
            .pipe()
            .on('data', buf => buffers.push(buf))
            .on('end', () => {
                const buffer = Buffer.concat(buffers);
                // Convert to Float32Array
                const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
                console.log(`Audio read: ${float32Array.length} samples`);
                resolve(float32Array);
            });
    });
}

async function testTranscription() {
    const filePath = path.join(__dirname, 'downloads', '57b8ed83-5c73-4ee6-8524-52d29c1e2bd1.mp4');
    
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    console.log(`Testing transcription for ${filePath}`);

    try {
        console.log('Importing modules...');
        const transformers = await import('@xenova/transformers');
        const pipeline = transformers.pipeline;
        
        console.log('Initializing pipeline...');
        const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
            progress_callback: (data) => {
                console.log('Model loading progress:', data);
            }
        });

        const audioData = await readAudio(filePath);
        
        // Test with first 5 minutes (16000 * 60 * 5 samples)
        const samplesToTest = 16000 * 60 * 5;
        const shortAudio = audioData.slice(0, samplesToTest);
        console.log(`Testing with first 5 minutes (${shortAudio.length} samples)...`);

        console.log('Running transcriber...');
        const output = await transcriber(shortAudio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true
        });

        console.log('Transcription output:', JSON.stringify(output, null, 2));

    } catch (error) {
        console.error('Transcription failed:', error);
    }
}

testTranscription();
