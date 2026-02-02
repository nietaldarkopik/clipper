
import { OllamaService } from './lib/ai-service';

async function debugService() {
    console.log('Starting debug service...');
    
    const url = 'https://prof.unwim.ac.id/api/chat';
    const model = 'llama3.1:8b';
    
    console.log(`Initializing OllamaService with url=${url}, model=${model}`);
    const service = new OllamaService(url, model);
    
    const transcript = "Ini adalah transkrip video pendek untuk testing. Harap buat ringkasan.";
    
    try {
        console.log('Calling generateSummary...');
        const summary = await service.generateSummary(transcript);
        console.log('Summary result:', summary);
    } catch (error: any) {
        console.error('Service call failed:', error);
        console.error('Error details:', error.message);
        if (error.response) {
             console.error('Response status:', error.response.status);
             console.error('Response data:', error.response.data);
        }
    }
}

debugService();
