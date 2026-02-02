
import fs from 'fs';
import path from 'path';

async function run() {
    const testFilePath = path.join(__dirname, 'test-record.webm');
    fs.writeFileSync(testFilePath, 'dummy video content');

    try {
        const fileBuffer = fs.readFileSync(testFilePath);
        
        // Construct multipart body manually to avoid dependency issues if FormData/Blob are not available or flaky
        const boundary = '--------------------------' + Date.now().toString(16);
        const filename = 'test-record.webm';
        const contentType = 'video/webm';
        
        const pre = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
            `Content-Type: ${contentType}\r\n\r\n`
        );
        const post = Buffer.from(`\r\n--${boundary}--\r\n`);
        
        const body = Buffer.concat([pre, fileBuffer, post]);

        const res = await fetch('http://127.0.0.1:3000/api/video/upload-file', {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length.toString()
            },
            body: body
        });
        
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Response:', data);
        
        if (res.status === 200) {
            console.log('Upload successful!');
        } else {
            console.log('Upload failed.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    }
}

run();
