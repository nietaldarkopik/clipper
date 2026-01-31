
import { exec as ytDlpExec } from 'yt-dlp-exec';
import path from 'path';

const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Use a short video (Me at the zoo)
const outputTemplate = path.join(process.cwd(), 'test-download.%(ext)s');

console.log('Testing yt-dlp download...');

const subprocess = ytDlpExec(url, {
  output: outputTemplate,
  format: 'mp4',
  noCheckCertificate: true,
  noWarnings: true,
  preferFreeFormats: true,
  writeInfoJson: true,
  writeSub: true,
  writeAutoSub: true,
  subFormat: 'json3',
});

subprocess.stdout?.on('data', (data: Buffer) => {
  console.log('STDOUT:', data.toString());
});

subprocess.stderr?.on('data', (data: Buffer) => {
  console.log('STDERR:', data.toString());
});

subprocess.on('close', (code: number) => {
  console.log('Exited with code:', code);
});

subprocess.on('error', (err: any) => {
  console.error('Error:', err);
});
