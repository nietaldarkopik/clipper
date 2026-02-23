import { Job } from 'bullmq';
import { createWorker } from './lib/queue-factory';
import path from 'path';
import fs from 'fs-extra';
import ytDlp from 'yt-dlp-exec';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import crypto from 'crypto';
import { getAIService } from './lib/ai-service';
import { saveVideo, saveTranscript, saveClip, saveJob, getVideo, saveUploadHistory } from './lib/db';
import { scrapeSearch } from './lib/web-scraper';
import { renderProjectVideo } from './lib/render-engine';

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

/**
 * Helper to burn captions (text overlay) onto a video clip
 */
const burnCaptions = async (inputPath: string, outputPath: string, text: string) => {
  // We'll use a simple background box and centered text
  // text may need escaping for ffmpeg
  const escapedText = text.replace(/'/g, "'\\\\''").replace(/:/g, '\\:');

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters([
        {
          filter: 'drawtext',
          options: {
            text: escapedText,
            fontcolor: 'white',
            fontsize: 32,
            box: 1,
            boxcolor: 'black@0.5',
            boxborderw: 5,
            x: '(w-text_w)/2',
            y: '(h-text_h)/2 + 100', // Positioned slightly below center
            shadowcolor: 'black',
            shadowx: 2,
            shadowy: 2
          }
        }
      ])
      .on('start', (cmd) => console.log('[FFmpeg Burn] CMD:', cmd))
      .on('end', () => resolve(undefined))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
};

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
    const { url, id, downloadSubtitles, projectId } = job.data; // Added projectId to job.data destructuring
    console.log(`[Download] Starting ${url} (Subtitles: ${downloadSubtitles})`);

    try {
      // Initial save for UI feedback
      saveVideo({ id, url, title: `Downloading ${id}`, status: 'downloading', progress: 0, project_id: projectId, source: 'youtube' });

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
        const subprocess = (ytDlp as any).exec(url, ytDlpOptions);

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
      const downloadedFilePath = path.join(downloadsDir, `${id}.mp4`);
      const processedFilePath = path.join(processedDir, `${id}.mp4`);
      const infoJsonPath = path.join(downloadsDir, `${id}.info.json`);

      // Move the downloaded video to the processed directory
      await fs.move(downloadedFilePath, processedFilePath, { overwrite: true });
      console.log(`[Download] Moved ${downloadedFilePath} to ${processedFilePath}`);

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

      // Update video status to completed and save metadata
      saveVideo({ id, status: 'completed', progress: 100, filepath: processedFilePath, ...metadata });

      // Save Job Metadata to DB
      try {
        saveJob({
          id: job.id || id,
          type: 'download',
          status: 'completed',
          progress: 100,
          result: { filePath: processedFilePath }
        });
      } catch (dbErr) {
        console.error('[DB] Failed to save job data', dbErr);
      }

      return { status: 'completed', filePath: processedFilePath };
    } catch (error: any) {
      console.error(`[Download] Failed ${id}`, error);
      // Update status to failed
      try {
        saveVideo({ id, status: 'failed', progress: 0 });
      } catch (e) { }
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
    // Find video file (mp4, webm, mkv) and avoid .info.json or .json or .wav
    const file = files.find(f => f.startsWith(id) && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')));

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
            const { clipId } = job.data; // Extract clipId if available
            saveClip({
              id: clipId || crypto.randomUUID(),
              video_id: id,
              start_time: startTime,
              end_time: startTime + duration,
              filepath: outputPath,
              label: `Clip ${startTime}-${startTime + duration}`
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

    // Prefer using filepath stored in DB (may point to processedDir or custom path)
    let inputPath: string | null = null;
    try {
      const videoRecord = getVideo(id) as any;
      if (videoRecord && videoRecord.filepath) {
        const candidatePath = videoRecord.filepath;
        if (await fs.pathExists(candidatePath)) {
          inputPath = candidatePath;
        }
      }
    } catch (e) {
      console.warn(`[Analyze] Failed to read video record for ${id}`, e);
    }

    // Fallback: search in downloads directory (legacy behavior)
    if (!inputPath) {
      const files = await fs.readdir(downloadsDir);
      let file = files.find(f =>
        f.startsWith(id) &&
        (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv'))
      );

      if (!file) {
        console.log(`[Analyze] Video file for ${id} not found initially in downloads, retrying...`);
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const updatedFiles = await fs.readdir(downloadsDir);
          file = updatedFiles.find(f =>
            f.startsWith(id) &&
            (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv'))
          );
          if (file) break;
        }
      }

      if (!file) {
        throw new Error(`File for ${id} not found in downloads directory after retries`);
      }

      inputPath = path.join(downloadsDir, file);
    }

    const audioPath = path.join(downloadsDir, `${id}.wav`);
    const transcriptPath = path.join(transcriptsDir, `${id}.json`);

    const aiService = getAIService();

    try {
      // 1. Extract Audio
      console.log(`[Analyze] Extracting audio for ${id} from ${inputPath}...`);
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat('wav')
          .outputOptions('-y') // Force overwrite if exists
          .on('start', (commandLine) => {
            console.log('[Analyze] FFmpeg process started:', commandLine);
          })
          .on('progress', (progress) => {
            // Map extraction to 0-30%
            if (progress.percent) {
              job.updateProgress(Math.min(30, Math.round(progress.percent * 0.3)));
            }
          })
          .on('end', () => {
            console.log(`[Analyze] Audio extraction completed: ${audioPath}`);
            resolve(undefined);
          })
          .on('error', (err) => {
            console.error(`[Analyze] FFmpeg error:`, err);
            reject(err);
          })
          .save(audioPath);
      });

      // 2. Transcribe
      console.log(`[Analyze] Transcribing audio for ${id}...`);
      job.updateProgress(30);

      let transcriptData: any;

      // Strategy 1: YouTube Subtitles (if method is youtube or auto)
      if (method === 'youtube' || method === 'auto') {
        try {
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

          await ytDlp(video.url, ytDlpOptions);

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
          console.log(`[Analyze] Successfully retrieved YouTube subtitles`);

        } catch (e: any) {
          console.warn(`[Analyze] YouTube subtitle strategy failed: ${e.message}`);
          if (method === 'youtube') {
            throw e; // Fail if explicitly requested
          }
          // Fallback to Whisper
        }
      }

      if (!transcriptData) {
        // Whisper logic
        console.log(`[Analyze] Using Whisper strategy...`);

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
            await job.updateData({ ...job.data, partialTranscript: accumulatedText });
          });

          // Add source metadata
          transcriptData.source = 'whisper';

          await fs.writeJson(transcriptPath, { ...transcriptData, videoId: id, createdAt: new Date() }, { spaces: 2 });
        }
      }

      // const transcriptText = transcriptData.text;
      job.updateProgress(100);

      // Save Transcript to DB
      try {
        saveTranscript({
          id: crypto.randomUUID(),
          video_id: id,
          type: transcriptData.source || 'whisper',
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

    } catch (error: any) {
      console.error(`[Analyze] Error analyzing ${id}:`, error);

      try {
        saveJob({
          id: job.id || `${id}_analyze`,
          type: 'analyze',
          status: 'failed',
          progress: 0,
          result: { error: error.message || String(error) }
        });
      } catch (dbErr) {
        console.error('[DB] Failed to save error status', dbErr);
      }

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

  const autoWorker = createWorker('auto', async (job: Job) => {
    const { keyword, count, platform = 'youtube', projectId, selectedVideos } = job.data;
    const logs: string[] = [];

    const addLog = async (msg: string) => {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] ${msg}`;
      console.log(`[AutoJob ${job.id}] ${logEntry}`);
      logs.push(logEntry);
      if (logs.length > 100) logs.shift();
      await job.updateData({ ...job.data, logs: logs.join('\n') });
    };

    await addLog(`Starting auto-process (keyword: "${keyword}", count: ${count})`);
    job.updateProgress(5);

    try {
      let results: any[] = [];
      if (Array.isArray(selectedVideos) && selectedVideos.length > 0) {
        results = selectedVideos.map((item: any) => ({
          id: item.id || item.url,
          title: item.title,
          url: item.url
        }));
        await addLog(`Using ${results.length} selected videos for processing.`);
      } else {
        await addLog(`Searching for viral content on ${platform}...`);
        if (platform === 'youtube') {
          const searchParam = `ytsearch${count}:${keyword}`;
          try {
            const output = await ytDlp(searchParam, {
              dumpSingleJson: true,
              noWarnings: true,
              flatPlaylist: true,
              noCheckCertificate: true,
              ffmpegLocation: ffmpegPath || undefined
            });
            results = (output as any).entries || [];
          } catch (searchErr: any) {
            await addLog(`YouTube search error: ${searchErr.message}`);
            throw searchErr;
          }
        } else {
          results = await scrapeSearch(keyword, platform, count);
        }
      }

      const totalVideos = results.length;
      if (totalVideos === 0) throw new Error(`No viral videos found for "${keyword}"`);

      await addLog(`Found ${totalVideos} videos. Starting loop.`);
      const aiService = getAIService();
      const processedClips = [];

      for (let i = 0; i < totalVideos; i++) {
        const vid = results[i];
        const videoUrl = vid.url || (platform === 'youtube' ? `https://www.youtube.com/watch?v=${vid.id}` : vid.url);
        const downloadId = crypto.randomUUID();

        try {
          await addLog(`[Video ${i + 1}/${totalVideos}] Processing: ${vid.title || vid.id}`);

          saveVideo({
            id: downloadId, url: videoUrl, title: vid.title || 'Auto Video',
            status: 'downloading', project_id: projectId, source: platform
          });

          const outputTemplate = path.join(downloadsDir, `${downloadId}.%(ext)s`);
          await ytDlp(videoUrl, {
            output: outputTemplate,
            format: 'mp4',
            noCheckCertificate: true,
            writeAutoSub: true,
            subFormat: 'json3',
            //subLangs: 'id.*,en.*',
            subLangs: 'id.*',
            jsRuntimes: 'node',   // 👈 TAMBAHKAN INI
            ffmpegLocation: ffmpegPath || undefined
          } as any);

          const videoPath = path.join(downloadsDir, `${downloadId}.mp4`);
          saveVideo({ id: downloadId, status: 'completed', filepath: videoPath, progress: 100 });

          // Extraction
          await addLog(`[Video ${i + 1}] Extracting transcript...`);
          let transcriptText = "";
          let transcriptData: any = null;
          let transcriptType = 'auto';

          const files = fs.readdirSync(downloadsDir);
          const subFile = files.find(f => f.startsWith(downloadId) && (f.endsWith('.json3') || f.endsWith('.vtt')));

          if (subFile) {
            const subPath = path.join(downloadsDir, subFile);
            if (subFile.endsWith('.json3')) {
              const jsonContent = fs.readJsonSync(subPath);
              transcriptData = jsonContent;
              transcriptText = jsonContent.events?.filter((e: any) => e.segs).map((e: any) => e.segs.map((s: any) => s.utf8).join('')).join(' ') || "";
              transcriptType = 'youtube';
              await addLog(`[Video ${i + 1}] Parsed YouTube JSON3 subtitles.`);
            } else {
              transcriptText = fs.readFileSync(subPath, 'utf-8').replace(/<[^>]*>/g, '').replace(/WEBVTT[\s\S]*?\n\n/, '');
              transcriptData = { text: transcriptText };
            }
          }

          if (!transcriptText || transcriptText.trim().length < 10) {
            await addLog(`[Video ${i + 1}] Falling back to AI Transcription...`);
            const audioPath = path.join(downloadsDir, `${downloadId}.wav`);
            await new Promise((resolve, reject) => {
              ffmpeg(videoPath).toFormat('wav').on('end', () => resolve(undefined)).on('error', (err) => reject(err)).save(audioPath);
            });
            transcriptData = await aiService.transcribeAudio(audioPath, 'tiny');
            transcriptText = transcriptData.text;
            transcriptType = 'whisper';
          }

          if (!transcriptText || transcriptText.trim().length < 10) throw new Error("Transcript empty");

          const tId = crypto.randomUUID();
          saveTranscript({
            id: tId, video_id: downloadId, type: transcriptType,
            content: transcriptData, created_at: new Date().toISOString()
          });
          await addLog(`[Video ${i + 1}] Transcript saved (Type: ${transcriptType}, ID: ${tId}, VideoID: ${downloadId})`);

          const highlights = await aiService.getHighlightsFromTranscript(transcriptText);
          if (highlights && highlights.length > 0) {
            const hl = highlights[0];
            await addLog(`[Video ${i + 1}] Clipping highlight: ${hl.title}`);
            const clipId = crypto.randomUUID();
            const rawClipPath = path.join(processedDir, `${clipId}_raw.mp4`);
            const finalClipPath = path.join(processedDir, `${clipId}.mp4`);

            await new Promise((resolve, reject) => {
              ffmpeg(videoPath).setStartTime(hl.start_time).setDuration(Math.max(5, hl.end_time - hl.start_time))
                .output(rawClipPath).on('end', () => resolve(undefined)).on('error', (err) => reject(err)).run();
            });

            try {
              await burnCaptions(rawClipPath, finalClipPath, hl.title);
              if (fs.existsSync(rawClipPath)) fs.unlinkSync(rawClipPath);
            } catch {
              if (fs.existsSync(rawClipPath)) fs.renameSync(rawClipPath, finalClipPath);
            }

            const metadata = await aiService.generateMetadata(`${hl.title}\n${hl.description}`);
            saveClip({
              id: clipId, video_id: downloadId, start_time: hl.start_time, end_time: hl.end_time,
              filepath: finalClipPath, label: metadata.titles[0] || hl.title, description: metadata.description
            });

            saveUploadHistory({
              id: crypto.randomUUID(), clip_id: clipId, platform: 'youtube',
              status: 'completed', url: `https://youtube.com/shorts/auto_${clipId}`, metadata, created_at: new Date().toISOString()
            });

            processedClips.push({ clipId, title: metadata.titles[0] });
          }
        } catch (videoErr: any) {
          await addLog(`[Video ${i + 1}] Error: ${videoErr.message}`);
        }
        job.updateProgress(10 + Math.round(((i + 1) / totalVideos) * 80));
      }

      await addLog(`Done! Processed ${processedClips.length} clips.`);
      return { status: 'completed', clips: processedClips };
    } catch (error: any) {
      await addLog(`Fatal Error: ${error.message}`);
      throw error;
    }
  });

  autoWorker.on('failed', (job, err) => {
    console.error(`[Auto] Job ${job?.id} failed with ${err.message}`);
  });

  const renderWorker = createWorker('render', async (job: Job) => {
      const { id, layers, clips, duration, resolution, format, projectId } = job.data;
      console.log(`[Render] Starting render for project ${projectId || 'unknown'} (Job: ${id})`);
      
      try {
        job.updateProgress(10);
        
        const width = resolution === '4k' ? 3840 : (resolution === '720p' ? 1280 : 1920);
        const height = resolution === '4k' ? 2160 : (resolution === '720p' ? 720 : 1080);
        const fps = 30;
        
        const outputFilename = `render_${projectId || 'project'}_${id}.${format || 'mp4'}`;
        const outputPath = path.join(processedDir, outputFilename);
        
        await renderProjectVideo(
            layers,
            clips,
            duration,
            {
                width,
                height,
                fps,
                outputPath
            }
        );
        
        job.updateProgress(100);
        console.log(`[Render] Completed: ${outputPath}`);
        
        // Save result as a new video in project (optional)
        if (projectId) {
            try {
                saveVideo({
                    id: crypto.randomUUID(),
                    project_id: projectId,
                    url: outputPath,
                    filepath: outputPath,
                    source: 'render',
                    title: `Rendered Project (${resolution})`,
                    created_at: new Date().toISOString(),
                    status: 'completed',
                    progress: 100,
                    duration: duration
                });
            } catch (e) {
                console.warn('Failed to save rendered video to DB', e);
            }
        }
        
        return { status: 'completed', filePath: outputPath };
      } catch (error: any) {
        console.error(`[Render] Failed ${id}`, error);
        throw error;
      }
  });
  
  renderWorker.on('failed', (job, err) => {
      console.error(`[Render] Job ${job?.id} failed with ${err.message}`);
  });
};
