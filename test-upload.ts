
import axios from 'axios';

const API_URL = 'http://localhost:3000';

async function testUpload() {
  try {
    console.log('Testing Upload Endpoint...');
    
    // 1. Trigger Upload
    const uploadRes = await axios.post(`${API_URL}/video/upload`, {
      filePath: 'd:\\www\\clipper-electron\\downloads\\mock_video.mp4',
      platform: 'tiktok',
      metadata: {
        title: 'Test Video',
        description: 'Testing upload flow',
        hashtags: '#test #dev'
      }
    });
    
    console.log('Upload Job Created:', uploadRes.data);
    const jobId = uploadRes.data.jobId;

    // 2. Poll Status
    let status = 'waiting';
    while (status !== 'completed' && status !== 'failed') {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await axios.get(`${API_URL}/dashboard/status/upload/${jobId}`);
      status = statusRes.data.state;
      console.log(`Job Status: ${status}, Progress: ${statusRes.data.progress}%`);
    }

    if (status === 'completed') {
      console.log('Upload Test PASSED!');
    } else {
      console.log('Upload Test FAILED!');
    }

  } catch (error: any) {
    console.error('Test Failed:', error.response ? error.response.data : error.message);
  }
}

testUpload();
