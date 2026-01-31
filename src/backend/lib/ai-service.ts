import OpenAI from 'openai';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import ffmpeg from 'fluent-ffmpeg';
// Use require for ffmpeg-static to ensure correct path resolution in all environments
const ffmpegPath = require('ffmpeg-static');

// Set ffmpeg path if available
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log('[LocalWhisper] ffmpeg path set to:', ffmpegPath);
} else {
    console.error('[LocalWhisper] ffmpeg-static not found!');
}

export interface AIMetadata {
  titles: string[];
  description: string;
  hashtags: string[];
  category: string;
}

export interface AIService {
  generateMetadata(context: string): Promise<AIMetadata>;
  transcribeAudio(filePath: string, modelSize?: string, onProgress?: (progress: number) => void, onPartial?: (text: string) => void): Promise<any>;
  getHighlightsFromTranscript(transcript: string): Promise<any[]>;
  generateSummary(transcript: string): Promise<string>;
  generateScript(summary: string, style?: string): Promise<string>;
  generateSpeech(text: string, voice?: string): Promise<Buffer>;
}

export class LocalWhisperService implements AIService {
    private openAI: OpenAIService;

    constructor(apiKey: string) {
        this.openAI = new OpenAIService(apiKey);
    }

    async generateMetadata(context: string): Promise<AIMetadata> {
        return this.openAI.generateMetadata(context);
    }

    async getHighlightsFromTranscript(transcript: string): Promise<any[]> {
        return this.openAI.getHighlightsFromTranscript(transcript);
    }

    async generateSummary(transcript: string): Promise<string> {
        return this.openAI.generateSummary(transcript);
    }

    async generateScript(summary: string, style?: string): Promise<string> {
        return this.openAI.generateScript(summary, style);
    }

    async generateSpeech(text: string, voice?: string): Promise<Buffer> {
        return this.openAI.generateSpeech(text, voice);
    }

    async transcribeAudio(filePath: string, modelSize: string = 'tiny', onProgress?: (progress: number) => void, onPartial?: (text: string) => void): Promise<any> {
        console.log(`[LocalWhisper] Starting transcription for ${filePath} with model ${modelSize}`);
        
        try {
            // Strategy 1: Transformers.js (Node-native, no Python required)
            // Dynamically import to avoid load-time errors if not installed
            return await this.transcribeWithTransformers(filePath, modelSize, onProgress, onPartial);
        } catch (e: any) {
            console.error('[LocalWhisper] Transformers.js failed:', e);
            console.log('[LocalWhisper] Falling back to Python Whisper CLI...');
            // Strategy 2: Python Whisper CLI
            return this.transcribeWithPythonWhisper(filePath, modelSize, onProgress, onPartial);
        }
    }

    private async readAudio(filePath: string): Promise<Float32Array> {
        console.log(`[LocalWhisper] Reading audio with ffmpeg: ${filePath}`);
        return new Promise((resolve, reject) => {
            const buffers: Buffer[] = [];
            ffmpeg(filePath)
                .toFormat('f32le')
                .audioChannels(1)
                .audioFrequency(16000)
                .on('error', (err) => {
                    console.error('[LocalWhisper] ffmpeg audio read error:', err);
                    reject(err);
                })
                .pipe()
                .on('data', (buf: Buffer) => buffers.push(buf))
                .on('end', () => {
                    const buffer = Buffer.concat(buffers);
                    // Convert to Float32Array
                    const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
                    console.log(`[LocalWhisper] Audio read: ${float32Array.length} samples`);
                    resolve(float32Array);
                });
        });
    }

    private async transcribeWithTransformers(filePath: string, modelSize: string = 'tiny', onProgress?: (progress: number) => void, onPartial?: (text: string) => void): Promise<any> {
        console.log('[LocalWhisper] Attempting to use @xenova/transformers in Worker Thread...');
        
        // Load audio using ffmpeg in main thread (fast)
        if (onProgress) onProgress(10);
        const audioData = await this.readAudio(filePath);
        
        console.log(`[LocalWhisper] Audio read: ${audioData.length} samples. Spawning worker...`);
        if (onProgress) onProgress(20);

        return new Promise((resolve, reject) => {
             const { Worker } = require('worker_threads');
             const path = require('path');
             const workerPath = path.join(__dirname, 'whisper.worker.mjs');
             
             const worker = new Worker(workerPath);
             
             worker.postMessage({ audioData, modelSize });
             
             worker.on('message', (message: any) => {
                 if (message.type === 'progress') {
                     if (onProgress) onProgress(message.value);
                 } else if (message.type === 'partial') {
                     if (onPartial) onPartial(message.text);
                 } else if (message.type === 'result') {
                     worker.terminate();
                     resolve(message.data);
                 } else if (message.type === 'error') {
                     worker.terminate();
                     reject(new Error(message.error));
                 }
             });
             
             worker.on('error', (err: any) => {
                 worker.terminate();
                 reject(err);
             });
             
             worker.on('exit', (code: number) => {
                 if (code !== 0) {
                     reject(new Error(`Worker stopped with exit code ${code}`));
                 }
             });
        });
    }

    private async transcribeWithPythonWhisper(filePath: string, modelSize: string = 'base', onProgress?: (progress: number) => void, onPartial?: (text: string) => void): Promise<any> {
        return new Promise((resolve, reject) => {
            // Assume 'whisper' command is available in PATH (e.g. pip install openai-whisper)
            // Usage: whisper audio.mp3 --model base --output_format json --output_dir /tmp
            const outputDir = path.dirname(filePath);
            const fileName = path.basename(filePath, path.extname(filePath));
            
            // Add ffmpeg-static to PATH
            // ffmpeg-static binary path depends on platform
            const ffmpegPath = require('ffmpeg-static');
            const ffmpegDir = path.dirname(ffmpegPath);
            const env = { ...process.env, PATH: `${process.env.PATH}${path.delimiter}${ffmpegDir}` };

            console.log(`[LocalWhisper] Using Python Whisper with model: ${modelSize}`);

            const whisperProcess = spawn('whisper', [
                filePath,
                '--model', modelSize,
                '--output_format', 'json',
                '--output_dir', outputDir,
                '--verbose', 'True' // Needed to parse progress
            ], { env });

            let errorOutput = '';

            whisperProcess.stdout.on('data', (data) => {
                const output = data.toString();
                // Parse progress from output like "[00:00.000 --> 00:02.000] Text"
                // This is a rough estimation as we don't know total duration easily here without probing
                // But we can just log it or pass a "heartbeat" progress
                if (output.includes('-->')) {
                    // console.log(`[Whisper Progress] ${output.trim()}`);
                    // We can't calculate percentage without duration, but we can signal "working"
                    // If caller provides a way to estimate percentage based on timestamps, we could do it.
                    // For now, let's just increment slightly or rely on the caller to know it's "processing"
                    if (onProgress) onProgress(50); // Just a placeholder to show activity
                    
                    // Extract text for streaming
                    // Output format usually: [00:00.000 --> 00:02.000] Text content
                    const match = output.match(/\[.*\] (.*)/);
                    if (match && match[1] && onPartial) {
                        onPartial(match[1].trim());
                    }
                }
            });

            whisperProcess.stderr.on('data', (data) => {
                const output = data.toString();
                // Whisper often prints progress to stderr
                if (output.includes('%')) {
                     // Try to extract percentage if available (tqdm style)
                     const match = output.match(/(\d+)%/);
                     if (match && onProgress) {
                         onProgress(parseInt(match[1]));
                     }
                }
                errorOutput += output;
            });

            whisperProcess.on('close', async (code) => {
                if (code === 0) {
                    try {
                        const jsonPath = path.join(outputDir, `${fileName}.json`);
                        if (await fs.pathExists(jsonPath)) {
                            const result = await fs.readJson(jsonPath);
                            // Cleanup generated files
                            // await fs.remove(jsonPath); // Optional: keep or delete? User might want to debug.
                            // The worker usually saves it to DB anyway.
                            
                            // Transform to match OpenAI format if needed, or just return as is
                            // OpenAI format has { text: "...", segments: [...] }
                            // Local whisper json format is similar
                            resolve(result);
                        } else {
                            reject(new Error('Transcript JSON file not found after success'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    console.error(`[LocalWhisper] Failed with code ${code}: ${errorOutput}`);
                    reject(new Error(`Whisper process exited with code ${code}. Error: ${errorOutput}`));
                }
            });

            whisperProcess.on('error', (err) => {
                 console.error('[LocalWhisper] Process spawn error:', err);
                 if ((err as any).code === 'ENOENT') {
                     reject(new Error('Whisper CLI not found. Please install OpenAI Whisper (pip install openai-whisper) OR run "npm install @xenova/transformers" for node-based whisper.'));
                 } else {
                     reject(err);
                 }
            });
        });
    }
}

export class OpenAIService implements AIService {
  private client: OpenAI;
  private fs = require('fs');

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async transcribeAudio(filePath: string, _modelSize?: string, _onProgress?: (progress: number) => void, _onPartial?: (text: string) => void): Promise<any> {
    try {
      const transcription = await this.client.audio.transcriptions.create({
        file: this.fs.createReadStream(filePath),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"]
      });
      return transcription;
    } catch (error) {
      console.error('OpenAI Transcription failed:', error);
      throw error;
    }
  }

  async generateSummary(transcript: string): Promise<string> {
    const prompt = `
      Summarize the following video transcript. Focus on the main plot points or key takeaways.
      Transcript: "${transcript.substring(0, 15000)}" 
      
      Return a concise summary (2-3 paragraphs).
    `;

    try {
        const response = await this.client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
        });
        return response.choices[0].message.content || "No summary generated.";
    } catch (error) {
        console.error('OpenAI Summary Generation failed:', error);
        return "Failed to generate summary.";
    }
  }

  async generateScript(summary: string, style: string = 'engaging'): Promise<string> {
    const prompt = `
      Create a voice-over script based on this summary. The style should be ${style}.
      Summary: "${summary}"
      
      Return the script text ready for reading or TTS.
    `;

    try {
        const response = await this.client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });
        return response.choices[0].message.content || "No script generated.";
    } catch (error) {
        console.error('OpenAI Script Generation failed:', error);
        return "Failed to generate script.";
    }
  }

  async generateSpeech(text: string, voice: string = 'alloy'): Promise<Buffer> {
      try {
          const mp3 = await this.client.audio.speech.create({
              model: "tts-1",
              voice: voice as any,
              input: text,
          });
          const buffer = Buffer.from(await mp3.arrayBuffer());
          return buffer;
      } catch (error) {
          console.error('OpenAI Speech Generation failed:', error);
          throw error;
      }
  }

    async getHighlightsFromTranscript(transcript: string): Promise<any[]> {
    // If transcript is very long, we might need to truncate or chunk it.
    // We assume transcript has timestamps if possible, but here we just have text.
    // Ideally we should pass segments. But for now let's ask for estimated timestamps.
    const prompt = `
      Analyze the following video transcript and identify 3-5 most viral/engaging segments (highlights).
      Transcript: "${transcript.substring(0, 15000)}" 
      
      Return a JSON object with a key "highlights" containing an array of objects with keys: 
      - title (string): Short title for the clip
      - description (string): Why it is interesting
      - start_time (number): Estimated start time in seconds (integer)
      - end_time (number): Estimated end time in seconds (integer)
      
      If you cannot determine exact timestamps, make a reasonable guess based on the flow, or default to 0 and 60.
    `;

    try {
        const response = await this.client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No highlights generated");
        
        const result = JSON.parse(content);
        return result.highlights || [];
    } catch (error) {
        console.error('OpenAI Highlight Analysis failed:', error);
        return [];
    }
  }

  async generateMetadata(context: string): Promise<AIMetadata> {
    const prompt = `
      You are a viral content expert. Generate metadata for a short video based on this context: "${context.substring(0, 5000)}".
      
      Requirements:
      1. Titles: Generate 3 distinct variations (Viral/Clickbait, Descriptive, Question-based).
      2. Description: Engaging, 2-3 sentences.
      3. Hashtags: 5-8 relevant viral hashtags (no #).
      4. Category: Choose one from [Entertainment, Educational, Gaming, Tech & AI, Lifestyle].
      
      Return ONLY a JSON object with keys: titles (array of strings), description, hashtags (array of strings), category.
    `;

    try {
        const response = await this.client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content generated");
        
        const result = JSON.parse(content);
        return {
            titles: Array.isArray(result.titles) ? result.titles : [result.title || 'Untitled'],
            description: result.description || '',
            hashtags: Array.isArray(result.hashtags) ? result.hashtags : [],
            category: result.category || 'Entertainment'
        };
    } catch (error) {
        console.error('OpenAI generation failed:', error);
        // Fallback or rethrow
        throw error;
    }
  }
}

// Singleton or Factory
let aiServiceInstance: AIService | null = null;

export const getAIService = (): AIService => {
    if (!aiServiceInstance) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY is not set");
        }
        // Use LocalWhisperService which handles fallback and hybrid usage
        aiServiceInstance = new LocalWhisperService(apiKey);
    }
    return aiServiceInstance;
};
