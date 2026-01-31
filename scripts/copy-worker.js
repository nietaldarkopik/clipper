const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/backend/lib/whisper.worker.mjs');
const dest = path.join(__dirname, '../dist/backend/lib/whisper.worker.mjs');

console.log(`Copying worker from ${src} to ${dest}...`);


try {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    console.log('Worker copied successfully.');
} catch (error) {
    console.error('Failed to copy worker:', error);
    process.exit(1);
}
