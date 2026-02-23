
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

const duration = 5;
const width = 1280;
const height = 720;
const fps = 30;

const cmd = ffmpeg();

console.log('Testing ffmpeg lavfi input...');

cmd.input(`color=c=black:s=${width}x${height}:d=${duration}:r=${fps}`)
   .inputOptions(['-f:v', 'lavfi'])
   .input(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration}`)
   .inputOptions(['-f:a', 'lavfi'])
   .output('test_output.mp4')
   .on('start', (commandLine) => {
       console.log('Spawned Ffmpeg with command: ' + commandLine);
   })
   .on('error', (err) => {
       console.error('Error:', err);
   })
   .on('end', () => {
       console.log('Success!');
   })
   .run();
