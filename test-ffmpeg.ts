import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

const runTest = (options: string[], input: string, name: string) => {
    return new Promise((resolve) => {
        console.log(`Running test: ${name} with options ${JSON.stringify(options)}`);
        const cmd = ffmpeg();
        cmd.input(input)
           .inputOptions(options)
           .output(`${name}.mp4`)
           .on('error', (err) => {
               console.error(`[${name}] Failed:`, err.message);
               resolve(false);
           })
           .on('end', () => {
               console.log(`[${name}] Success`);
               resolve(true);
           })
           .run();
    });
};

(async () => {
    // Video
    // await runTest(['-f:v', 'lavfi'], 'color=c=black:s=100x100:d=1', 'test_video_fv');
    
    // Audio
    await runTest(['-f:a', 'lavfi'], 'anullsrc=channel_layout=stereo:sample_rate=44100:d=1', 'test_audio_fa');
    
    // Check if -f:v works for audio? (Likely not, but let's see)
    // await runTest(['-f:v', 'lavfi'], 'anullsrc=channel_layout=stereo:sample_rate=44100:d=1', 'test_audio_fv');
})();
