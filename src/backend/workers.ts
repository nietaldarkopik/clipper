import { Job } from 'bullmq';
import { createWorker } from './lib/queue-factory';
import path from 'path';
import fs from 'fs-extra';
import ytDlp from 'yt-dlp-exec';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import crypto from 'crypto';
import { getAIService } from './lib/ai-service';
import { saveVideo, saveTranscript, saveClip, saveJob } from './lib/db';

// Check if ffmpegPath is valid
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.warn('FFmpeg binary not found via ffmpeg-static. Please ensure ffmpeg is installed.');
}

const downloadsDir = path.join(process.cwd(), 'downloads');
const processedDir = path.join(process.cwd(), 'processed');
const transcriptsDir = path.join(process.cwd(), 'transcripts');

// Ensure dirs exist
fs.ensureDirSync(downloadsDir);
fs.ensureDirSync(processedDir);
fs.ensureDirSync(transcriptsDir);

export const startWorkers = () => {
  const downloadWorker = createWorker('download', async (job: Job) => {
    const { url, id } = job.data;
    console.log(`[Download] Starting ${url}`);
    
    try {
      const outputTemplate = path.join(downloadsDir, `${id}.%(ext)s`);
      
      await ytDlp(url, {
        output: outputTemplate,
        format: 'mp4',
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
      });
      
      console.log(`[Download] Completed ${id}`);
      const filePath = path.join(downloadsDir, `${id}.mp4`);

      // Save Video Metadata to DB
      try {
        saveVideo({
          id,
          url,
          filepath: filePath,
          source: 'youtube',
          title: `Video ${id}`,
          created_at: new Date().toISOString()
        });
        saveJob({
          id: job.id || id,
          type: 'download',
          status: 'completed',
          progress: 100,
          result: { filePath }
        });
      } catch (dbErr) {
        console.error('[DB] Failed to save video data', dbErr);
      }

      return { status: 'completed', filePath };
    } catch (error: any) {
      console.error(`[Download] Failed ${id}`, error);
      throw error;
    }
  });

  downloadWorker.on('failed', (job, err) => {
      console.error(`[Download] Job ${job?.id} failed with ${err.message}`);
  });

  const processWorker = createWorker('process', async (job: Job) => {
    const { id, startTime, duration } = job.data;
    console.log(`[Process] Clipping ${id} from ${startTime} for ${duration}s`);
    
    const files = await fs.readdir(downloadsDir);
    const file = files.find(f => f.startsWith(id));
    
    if (!file) {
      throw new Error('File not found');
    }
    
    const inputPath = path.join(downloadsDir, file);
    const outputPath = path.join(processedDir, `${id}_clip_${startTime}.mp4`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(outputPath)
        .on('progress', (progress) => {
          if (progress.percent) {
            job.updateProgress(Math.round(progress.percent));
          }
        })
        .on('end', () => {
          console.log(`[Process] Clip created: ${outputPath}`);
          
          // Save Clip to DB
          try {
            saveClip({
              id: crypto.randomUUID(),
              video_id: id,
              start_time: startTime,
              end_time: startTime + duration,
              filepath: outputPath,
              label: `Clip ${startTime}-${startTime+duration}`
            });
            saveJob({
              id: job.id || `${id}_process`,
              type: 'process',
              status: 'completed',
              progress: 100,
              result: { path: outputPath }
            });
          } catch (dbErr) {
            console.error('[DB] Failed to save clip data', dbErr);
          }

          resolve({ path: outputPath });
        })
        .on('error', (err) => {
          console.error('[Process] Error:', err);
          reject(err);
        })
        .run();
    });
  });

  processWorker.on('failed', (job, err) => {
      console.error(`[Process] Job ${job?.id} failed with ${err.message}`);
  });

  const analyzeWorker = createWorker('analyze', async (job: Job) => {
      const { id } = job.data;
      console.log(`[Analyze] Starting analysis for ${id}`);
      job.updateProgress(1);
      
      const files = await fs.readdir(downloadsDir);
      // Prioritize video files and exclude artifacts like .mp3 or .json
      let file = files.find(f => f.startsWith(id) && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')));

      // Retry mechanism for file detection (wait up to 5 seconds)
      if (!file) {
          console.log(`[Analyze] Video file for ${id} not found initially, retrying...`);
          for (let i = 0; i < 5; i++) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              const updatedFiles = await fs.readdir(downloadsDir);
              file = updatedFiles.find(f => f.startsWith(id) && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')));
              if (file) break;
          }
      }

      if (!file) {
        throw new Error(`File for ${id} not found in downloads directory after retries`);
      }

      const inputPath = path.join(downloadsDir, file);
      const audioPath = path.join(downloadsDir, `${id}.wav`);
      const transcriptPath = path.join(transcriptsDir, `${id}.json`);

      const aiService = getAIService();

      try {
          // 1. Extract Audio
          console.log(`[Analyze] Extracting audio for ${id}...`);
          await new Promise((resolve, reject) => {
              ffmpeg(inputPath)
                  .toFormat('wav')
                  .outputOptions('-y') // Force overwrite if exists
                  .on('progress', (progress) => {
                      // Map extraction to 0-30%
                      if (progress.percent) {
                          job.updateProgress(Math.min(30, Math.round(progress.percent * 0.3)));
                      }
                  })
                  .on('end', resolve)
                  .on('error', reject)
                  .save(audioPath);
          });

          // 2. Transcribe
          console.log(`[Analyze] Transcribing audio for ${id}...`);
          job.updateProgress(30);
          
          let transcriptData: any;
          // Check if transcript already exists to save time/cost
          if (fs.existsSync(transcriptPath)) {
               transcriptData = await fs.readJson(transcriptPath);
               console.log(`[Analyze] Using cached transcript for ${id}`);
          } else {
               transcriptData = await aiService.transcribeAudio(audioPath, (progress) => {
                   // Map transcription progress to 30-80% range (50% of total)
                   const mappedProgress = 30 + Math.round(progress * 0.5);
                   job.updateProgress(mappedProgress);
               });
               await fs.writeJson(transcriptPath, { ...transcriptData, videoId: id, createdAt: new Date() });
          }
          
          const transcriptText = transcriptData.text;
          job.updateProgress(80);

          // 3. Analyze with LLM
          console.log(`[Analyze] Finding highlights for ${id}...`);
          const highlights = await aiService.getHighlightsFromTranscript(transcriptText);
          
          job.updateProgress(90);

          // Cleanup audio file
          if (fs.existsSync(audioPath)) {
              await fs.unlink(audioPath);
          }

          // Save Transcript to DB
          try {
            saveTranscript({
              id: crypto.randomUUID(),
              video_id: id,
              content: transcriptData
            });
            saveJob({
              id: job.id || `${id}_analyze`,
              type: 'analyze',
              status: 'completed',
              progress: 100,
              result: { transcript: transcriptData, highlights }
            });
          } catch (dbErr) {
            console.error('[DB] Failed to save transcript data', dbErr);
          }

          console.log(`[Analyze] Completed for ${id}`, highlights);
          return { transcript: transcriptData, highlights, transcriptPath };

      } catch (error) {
          console.error(`[Analyze] Error analyzing ${id}:`, error);
          throw error;
      }
  });

  analyzeWorker.on('failed', (job, err) => {
      console.error(`[Analyze] Job ${job?.id} failed with ${err.message}`);
  });

  const uploadWorker = createWorker('upload', async (job: Job) => {
    const { filePath, platform, metadata } = job.data;
    console.log(`[Upload] Starting upload to ${platform} for ${filePath}`);
    console.log(`[Upload] Metadata:`, metadata);

    // Simulate upload process
    const totalSteps = 10;
    for (let i = 0; i <= totalSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        const progress = Math.round((i / totalSteps) * 100);
        job.updateProgress(progress);
    }

    console.log(`[Upload] Completed upload to ${platform}`);
    return { status: 'completed', platform, url: `https://${platform}.com/video/mock_id_123` };
  });

  uploadWorker.on('failed', (job, err) => {
      console.error(`[Upload] Job ${job?.id} failed with ${err.message}`);
  });
  
  console.log('Workers initialized: Download, Process, Analyze, Upload');
};
