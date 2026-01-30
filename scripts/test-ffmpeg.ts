
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log('FFmpeg path set to:', ffmpegPath);
} else {
  console.error('FFmpeg path not found!');
  process.exit(1);
}

ffmpeg.getAvailableFormats((err, formats) => {
  if (err) {
    console.error('FFmpeg failed:', err);
  } else {
    console.log('FFmpeg works! Format count:', Object.keys(formats).length);
  }
});
