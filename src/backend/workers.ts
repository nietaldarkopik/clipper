import { Job } from 'bullmq';
import { createWorker } from './lib/queue-factory';
import path from 'path';
import fs from 'fs-extra';
import { exec as ytDlpExec } from 'yt-dlp-exec';
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

// Map to track active download processes
const activeDownloads = new Map<string, any>();

export const cancelDownloadJob = (jobId: string) => {
    const subprocess = activeDownloads.get(jobId);
    if (subprocess) {
        console.log(`[Worker] Killing process for job ${jobId}`);
        subprocess.kill('SIGKILL'); // Force kill
        activeDownloads.delete(jobId);
        return true;
    }
    return false;
};

export const startWorkers = () => {
  const downloadWorker = createWorker('download', async (job: Job) => {
    const { url, id, downloadSubtitles } = job.data;
    console.log(`[Download] Starting ${url} (Subtitles: ${downloadSubtitles})`);
    
    try {
      const outputTemplate = path.join(downloadsDir, `${id}.%(ext)s`);
      
      const ytDlpOptions: any = {
          output: outputTemplate,
          format: 'mp4',
          noCheckCertificate: true,
          noWarnings: true,
          preferFreeFormats: true,
          writeInfoJson: true,
      };

      if (downloadSubtitles) {
          ytDlpOptions.writeSub = true;
          ytDlpOptions.writeAutoSub = true;
          ytDlpOptions.subFormat = 'json3';
      }

      // Use exec to get progress events
      await new Promise<void>((resolve, reject) => {
        const subprocess = ytDlpExec(url, ytDlpOptions);

        // Track process
        activeDownloads.set(id, subprocess);

        let lastUpdate = 0;
        let buffer = '';
        let errorBuffer = '';
        
        const handleOutput = (data: Buffer) => {
            buffer += data.toString();
            // ... (existing logic for stdout)
            const lines = buffer.split(/[\r\n]+/);
            buffer = lines.pop() || ''; 
            for (const line of lines) {
                const match = line.match(/\[download\]\s+(\d+\.?\d*)%/);
                if (match) {
                    const percent = parseFloat(match[1]);
                    job.updateProgress(percent);
                    const now = Date.now();
                    if (now - lastUpdate > 1000) {
                        saveVideo({ id, status: 'downloading', progress: percent });
                        lastUpdate = now;
                    }
                }
            }
        };

        const handleError = (data: Buffer) => {
            const chunk = data.toString();
            errorBuffer += chunk;
            console.error(`[yt-dlp ${id}] stderr:`, chunk);
            // Also process progress from stderr as yt-dlp sometimes writes progress there
            handleOutput(data); 
        };

        subprocess.stdout?.on('data', handleOutput);
        subprocess.stderr?.on('data', handleError);

        subprocess.on('close', (code: number) => {
          activeDownloads.delete(id);
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp exited with code ${code}. Stderr: ${errorBuffer}`));
        });

        subprocess.on('error', (err: any) => {
            activeDownloads.delete(id);
            reject(err);
        });
      });
      
      console.log(`[Download] Completed ${id}`);
      const filePath = path.join(downloadsDir, `${id}.mp4`);
      const infoJsonPath = path.join(downloadsDir, `${id}.info.json`);

      // Read metadata from info.json
      let metadata: any = { title: `Video ${id}` };
      try {
        if (fs.existsSync(infoJsonPath)) {
            const info = fs.readJsonSync(infoJsonPath);
            metadata = {
                title: info.title,
                description: info.description,
                uploader: info.uploader,
                duration: info.duration,
                view_count: info.view_count,
                like_count: info.like_count,
                thumbnail: info.thumbnail,
                webpage_url: info.webpage_url,
                upload_date: info.upload_date,
                tags: info.tags
            };
        }
      } catch (e) {
          console.warn('Failed to read info.json', e);
      }

      // Check for transcripts (yt-dlp names them like id.en.json3)
      try {
          const files = fs.readdirSync(downloadsDir);
          const transcriptFile = files.find(f => f.startsWith(id) && f.endsWith('.json3'));
          if (transcriptFile) {
              const tContent = fs.readJsonSync(path.join(downloadsDir, transcriptFile));
              // Convert json3 to simpler format if needed, or store as is
              // Json3 usually has 'events' array
              saveTranscript({
                  id: crypto.randomUUID(),
                  video_id: id,
                  type: 'youtube',
                  content: tContent,
                  created_at: new Date().toISOString()
              });
          }
      } catch (e) {
          console.warn('Failed to process transcripts', e);
      }

      // Save Video Metadata to DB
      try {
        saveVideo({
          id,
          url,
          filepath: filePath,
          source: 'youtube',
          ...metadata,
          created_at: new Date().toISOString(),
          status: 'completed',
          progress: 100
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
      // Update status to failed
      try {
          saveVideo({ id, status: 'failed', progress: 0 });
      } catch (e) {}
      throw error;
    }
  });

  downloadWorker.on('failed', (job, err) => {
      console.error(`[Download] Job ${job?.id} failed with ${err.message}`);
  });

  const processWorker = createWorker('process', async (job: Job) => {
    if (job.name === 'merge-clips') {
        const { clipIds, projectId, outputName } = job.data;
        console.log(`[Process] Merging clips: ${clipIds.join(', ')}`);
        
        // We need to find the file paths for these clips
        // Assuming clipIds are IDs of clips in DB which have filepath
        // But for simplicity, let's assume clipIds are actually file paths or we look them up.
        // Wait, the frontend might pass file paths directly or IDs.
        // Best to pass IDs and lookup in DB. But DB lookup is synchronous/async.
        // Let's assume the caller resolves paths or we do it here.
        // Since we don't have easy DB access inside worker (we do have saveClip etc but not getClip),
        // let's pass file paths in job data for now to avoid DB dependency issues in worker if not setup.
        // Actually we import { saveVideo } from ./lib/db. We can import { getClip } if it exists.
        // Let's check db.ts later. For now, let's assume job.data has filePaths.
        
        const { filePaths } = job.data as { filePaths: string[], projectId: string, outputName: string };
        
        if (!filePaths || filePaths.length === 0) {
            throw new Error("No files to merge");
        }

        const outputPath = path.join(processedDir, `${projectId}_${outputName || 'merged'}_${Date.now()}.mp4`);
        const listPath = path.join(processedDir, `${projectId}_merge_list_${Date.now()}.txt`);
        
        // Create ffmpeg concat list file
        // file '/path/to/file1.mp4'
        // file '/path/to/file2.mp4'
        const listContent = filePaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
        await fs.writeFile(listPath, listContent);
        
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(listPath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions('-c', 'copy')
                .save(outputPath)
                .on('end', async () => {
                    console.log(`[Process] Merge completed: ${outputPath}`);
                    await fs.unlink(listPath); // Cleanup list file
                    
                    // Save result as a new video in project
                    if (projectId) {
                        saveVideo({
                            id: crypto.randomUUID(),
                            project_id: projectId,
                            url: outputPath,
                            filepath: outputPath,
                            source: 'merge',
                            title: outputName || 'Merged Video',
                            created_at: new Date().toISOString(),
                            status: 'completed',
                            progress: 100
                        });
                    }
                    
                    resolve({ filePath: outputPath });
                })
                .on('error', (err) => {
                    console.error('[Process] Merge error:', err);
                    reject(err);
                });
        });
    }

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
      const { id, modelSize, method } = job.data;
      console.log(`[Analyze] Starting analysis for ${id} with model ${modelSize || 'tiny'}`);
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
          
          if (method === 'youtube') {
              // Fetch video URL
              const video = getVideo(id);
              if (!video || !video.url) {
                  throw new Error("Video URL not found for YouTube subtitle download");
              }

              console.log(`[Analyze] Downloading subtitles from YouTube for ${id}...`);
              
              const outputTemplate = path.join(downloadsDir, `${id}.%(ext)s`);
              const ytDlpOptions: any = {
                  output: outputTemplate,
                  skipDownload: true,
                  writeSub: true,
                  writeAutoSub: true,
                  subFormat: 'json3',
                  noCheckCertificate: true,
                  noWarnings: true,
                  preferFreeFormats: true,
              };

              await ytDlpExec(video.url, ytDlpOptions);

              // Find the subtitle file
              const files = fs.readdirSync(downloadsDir);
              const transcriptFile = files.find(f => f.startsWith(id) && f.endsWith('.json3'));
              
              if (!transcriptFile) {
                  throw new Error("YouTube subtitles not found after download attempt");
              }

              const tContent = await fs.readJson(path.join(downloadsDir, transcriptFile));
              
              // Extract text from json3 events
              let fullText = '';
              if (tContent.events) {
                  fullText = tContent.events
                      .filter((e: any) => e.segs)
                      .map((e: any) => e.segs.map((s: any) => s.utf8).join(''))
                      .join(' ');
              }

              transcriptData = {
                  text: fullText,
                  raw: tContent,
                  source: 'youtube'
              };
              
          } else {
              // Whisper logic
              // Check if transcript already exists to save time/cost
              // If modelSize is explicitly provided (via prompt) OR method is 'whisper', we treat it as a fresh run request if user initiated it.
              // Ideally, we should check if the existing transcript is good enough, but for now, 
              // if the user explicitly requested 'whisper' or 'modelSize', we re-run ONLY if forced.
              // Actually, simpler logic: If transcript exists AND modelSize is NOT provided (auto-mode), use cache.
              // If modelSize IS provided, it means user manually triggered it with a choice, so we re-run.
              
              const shouldTranscribe = !fs.existsSync(transcriptPath) || !!modelSize;

              if (!shouldTranscribe) {
                    transcriptData = await fs.readJson(transcriptPath);
                    console.log(`[Analyze] Using cached transcript for ${id}`);
               } else {
                    let accumulatedText = '';
                    transcriptData = await aiService.transcribeAudio(audioPath, modelSize, (progress) => {
                        // Map transcription progress to 30-80% range (50% of total)
                        const mappedProgress = 30 + Math.round(progress * 0.5);
                        job.updateProgress(mappedProgress);
                    }, async (partialText) => {
                        accumulatedText += partialText + ' ';
                        // Update job data for frontend streaming
                        // We throttle updates slightly if needed, but for now direct update
                        await job.update({ ...job.data, partialTranscript: accumulatedText });
                    });
                    await fs.writeJson(transcriptPath, { ...transcriptData, videoId: id, createdAt: new Date() }, { spaces: 2 });
               }
          }
          
          const transcriptText = transcriptData.text;
          job.updateProgress(100);

          // Save Transcript to DB
          try {
            saveTranscript({
              id: crypto.randomUUID(),
              video_id: id,
              type: 'whisper',
              content: transcriptData,
              created_at: new Date().toISOString()
            });

            saveJob({
              id: job.id || `${id}_analyze`,
              type: 'analyze',
              status: 'completed',
              progress: 100,
              result: { transcript: transcriptData }
            });
          } catch (dbErr) {
            console.error('[DB] Failed to save transcript data', dbErr);
          }

          console.log(`[Analyze] Completed for ${id}`);
          return { transcript: transcriptData, transcriptPath };

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
