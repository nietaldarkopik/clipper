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
  title: string;
  description: string;
  hashtags: string[];
  category: string;
}

export interface AIService {
  generateMetadata(context: string): Promise<AIMetadata>;
  transcribeAudio(filePath: string, onProgress?: (progress: number) => void): Promise<any>;
  getHighlightsFromTranscript(transcript: string): Promise<any[]>;
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

    async transcribeAudio(filePath: string, onProgress?: (progress: number) => void): Promise<any> {
        console.log(`[LocalWhisper] Starting transcription for ${filePath}`);
        
        try {
            // Strategy 1: Transformers.js (Node-native, no Python required)
            // Dynamically import to avoid load-time errors if not installed
            return await this.transcribeWithTransformers(filePath, onProgress);
        } catch (e: any) {
            console.error('[LocalWhisper] Transformers.js failed:', e);
            console.log('[LocalWhisper] Falling back to Python Whisper CLI...');
            // Strategy 2: Python Whisper CLI
            return this.transcribeWithPythonWhisper(filePath, onProgress);
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

    private async transcribeWithTransformers(filePath: string, onProgress?: (progress: number) => void): Promise<any> {
        console.log('[LocalWhisper] Attempting to use @xenova/transformers...');
        
        // Dynamic imports
         let pipeline: any;
         try {
              // @ts-ignore
              const transformers = await import('@xenova/transformers');
              pipeline = transformers.pipeline;
         } catch (err) {
            throw new Error('Module @xenova/transformers not found. Please run "npm install @xenova/transformers"');
         }

         // Initialize pipeline
        // Use quantized model for speed and lower memory
        const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
             progress_callback: (data: any) => {
                 // data: { status: 'progress', loaded: 123, total: 123, ... } for download
                 if (data.status === 'progress' && onProgress) {
                     // Loading model
                     const percent = Math.round((data.loaded / data.total) * 100);
                     // Map model loading to 0-20%
                     onProgress(Math.round(percent * 0.2));
                 }
             }
        });

        // Load audio using ffmpeg
        if (onProgress) onProgress(20);
        const audioData = await this.readAudio(filePath);
        
        console.log('[LocalWhisper] Running pipeline...');
        if (onProgress) onProgress(30);

        const output = await transcriber(audioData, {
            chunk_length_s: 30,
             stride_length_s: 5,
             return_timestamps: true,
             callback_function: (_item: any) => {
                  // Callback for partial results
             }
        });
        
        // Output format: { text: "...", chunks: [ { timestamp: [a,b], text: "..." } ] }
        // We need to map this to OpenAI verbose_json format:
        // { text: "...", segments: [ { start: 0, end: 1, text: "..." } ] }
        
        const segments = output.chunks.map((chunk: any) => ({
            start: chunk.timestamp[0],
            end: chunk.timestamp[1],
            text: chunk.text
        }));

        if (onProgress) onProgress(100);

        return {
            text: output.text,
            segments: segments,
            language: 'english' // auto-detected usually
        };
    }

    private async transcribeWithPythonWhisper(filePath: string, onProgress?: (progress: number) => void): Promise<any> {
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

            const whisperProcess = spawn('whisper', [
                filePath,
                '--model', 'base',
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

  async transcribeAudio(filePath: string, _onProgress?: (progress: number) => void): Promise<any> {
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

  async getHighlightsFromTranscript(transcript: string): Promise<any[]> {
    const prompt = `
      Analyze the following video transcript and identify 3-5 most viral/engaging segments (highlights).
      Transcript: "${transcript.substring(0, 15000)}" 
      
      Return a JSON object with a key "highlights" containing an array of objects with keys: 
      - start_quote (string): The starting text of the segment
      - end_quote (string): The ending text of the segment
      - reasoning (string): Why this is viral
      - estimated_start_time (string): approximate timestamp if inferred, otherwise null
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
      You are a viral content expert. Generate metadata for a short video based on this context: "${context}".
      
      Requirements:
      1. Title: Catchy, clickbait-style but honest, under 60 chars.
      2. Description: Engaging, 2-3 sentences.
      3. Hashtags: 5-8 relevant viral hashtags.
      4. Category: Choose one from [Entertainment, Educational, Gaming, Tech & AI, Lifestyle].
      
      Return ONLY a JSON object with keys: title, description, hashtags (array of strings), category.
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
            title: result.title || '',
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
