import axios from 'axios';

const url = 'https://prof.unwim.ac.id/api/chat';
const payload = {
    model: 'llama3.1:8b',
    messages: [{ role: 'user', content: 'apa kamu bisa rekap film berdasarkan transcript video?' }],
    stream: true
};

async function testOllama() {
    console.log(`Sending request to ${url}...`);
    try {
        const response = await axios.post(url, payload, {
            responseType: 'stream'
        });

        console.log('Response status:', response.status);
        
        response.data.on('data', (chunk: Buffer) => {
            console.log('Received chunk:', chunk.toString());
        });

        response.data.on('end', () => {
            console.log('Stream ended');
        });

        response.data.on('error', (err: any) => {
            console.error('Stream error:', err);
        });

    } catch (error: any) {
        console.error('Request failed:', error.message);
        if (error.response) {
            console.error('Error status:', error.response.status);
            // Try to read error body if possible
            if (error.response.data && typeof error.response.data.on === 'function') {
                error.response.data.on('data', (d: any) => console.error('Error body:', d.toString()));
            } else {
                 console.error('Error data:', error.response.data);
            }
        }
    }
}

testOllama();
