
import ytDlp from 'yt-dlp-exec';

const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

async function test() {
  console.log('Testing yt-dlp...');
  try {
    const output = await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
    });
    console.log('Title:', output.title);
    console.log('Duration:', output.duration);
    console.log('yt-dlp works!');
  } catch (error) {
    console.error('yt-dlp failed:', error);
  }
}

test();
