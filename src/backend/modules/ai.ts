import OpenAI from 'openai';
import fs from 'fs';

// OpenAI integration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  dangerouslyAllowBrowser: true // Just in case, though we are in node
});

export const analyzeVideoTranscript = async (transcript: string, onProgress?: (p: number) => void) => {
  // Mock analysis if no key provided
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder') {
    console.log('[AI] No OpenAI API Key found. Returning mock highlights.');
    
    // Simulate progress
    if (onProgress) {
        for (let i = 0; i <= 100; i += 20) {
            onProgress(i);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return [
      { start: 10, end: 45, label: 'Mock Highlight 1', score: 0.9 },
      { start: 60, end: 90, label: 'Mock Highlight 2', score: 0.85 }
    ];
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are a viral video editor. Analyze the transcript and identify 2-3 viral segments. Return a JSON object with a key 'segments' containing an array of objects, each with 'start' (number, seconds), 'end' (number, seconds), 'label' (string), and 'score' (number, 0-1)."
        },
        {
          role: "user",
          content: transcript
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) return [];
    
    const parsed = JSON.parse(content);
    return parsed.segments || [];
  } catch (error) {
    console.error('[AI] Error analyzing transcript:', error);
    throw error;
  }
};

export const transcribeAudio = async (filePath: string) => {
    console.log(`[AI] Transcribing ${filePath}...`);
    
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder') {
       console.log('[AI] No API Key. Using mock transcript.');
       return "This is a mock transcript of the video. It contains some very interesting viral moments that everyone will love.";
    }

    if (filePath === 'mock_path') {
       console.log('[AI] Mock path provided. Using mock transcript.');
       return "This is a mock transcript because the video file was not found.";
    }

    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-1",
        });
        
        console.log('[AI] Transcription complete.');
        return transcription.text;
    } catch (error) {
        console.error('[AI] Transcription failed:', error);
        throw error;
    }
}
