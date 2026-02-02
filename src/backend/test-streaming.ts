
import axios from 'axios';
import path from 'path';
import fs from 'fs-extra';

// Mock getDB to avoid import issues if paths are tricky, or just read file directly
const dbPath = path.join(process.cwd(), 'data', 'db.json');
const db = fs.readJsonSync(dbPath);

async function testStreaming() {
    // Find a transcript
    const transcriptEntry = db.transcripts[0]; 
    if (!transcriptEntry) {
        console.log("No transcripts found in DB.");
        return;
    }
    
    let content = transcriptEntry.content;
    if (!Array.isArray(content)) {
        console.log("Transcript content is not an array, using mock data.");
        // Mock data
        content = [];
        for (let i = 0; i < 200; i++) { // 200 segments * ~3 sec = 600 sec = 10 mins -> 4 chunks
            content.push({
                start: i * 3,
                end: i * 3 + 2.5,
                text: `This is segment number ${i}. It contains some random text to simulate a video transcript.`
            });
        }
    } else {
        console.log(`Found transcript with ${content.length} segments.`);
    }

    console.log(`Sending transcript...`);
    
    try {
        const response = await axios.post('http://localhost:3001/api/ai/generate-summary', {
            transcript: content
        }, {
            responseType: 'stream'
        });

        response.data.on('data', (chunk: Buffer) => {
            process.stdout.write(chunk.toString());
        });

        response.data.on('end', () => {
            console.log('\n\nStream ended.');
        });
    } catch (e: any) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            // e.response.data might be a stream or text
            if (e.response.data.on) {
                e.response.data.pipe(process.stdout);
            } else {
                console.log(e.response.data);
            }
        }
    }
}

testStreaming();
