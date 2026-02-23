
import ytDlp from 'yt-dlp-exec';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs-extra';

const url = 'https://www.youtube.com/watch?v=6rEXLSIHod0';
const outputDir = path.join(process.cwd(), 'test-downloads');
fs.ensureDirSync(outputDir);
const outputTemplate = path.join(outputDir, 'test-video-retry.%(ext)s');

console.log('Testing yt-dlp download with retry logic...');

const ytDlpOptions = {
  output: outputTemplate,
  format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
  mergeOutputFormat: 'mp4',
  noCheckCertificate: true,
  writeAutoSub: true,
  subFormat: 'json3',
  subLangs: 'id.*',
  jsRuntimes: 'node',
  ffmpegLocation: ffmpegPath || undefined
};

async function run() {
  try {
    console.log('Attempt 1: With subtitles');
    await ytDlp(url, ytDlpOptions as any);
    console.log('Download successful!');
  } catch (e: any) {
    const errMessage = e.message || e.stderr || '';
    console.log('Attempt 1 failed. Error:', errMessage.substring(0, 200) + '...');
    
    if (errMessage.includes('429') || errMessage.includes('subtitles') || errMessage.includes('Command failed')) {
       console.log('Retrying without subtitles...');
       const retryOptions = { ...ytDlpOptions, writeAutoSub: false, writeSub: false, subFormat: undefined, subLangs: undefined };
       try {
         await ytDlp(url, retryOptions as any);
         console.log('Retry successful (video only)!');
       } catch (retryErr: any) {
         console.error('Retry also failed:', retryErr.message);
       }
    } else {
       console.error('Fatal error:', e);
    }
  }
}

run();
