
import axios from 'axios';

const API_URL = 'http://localhost:3000';

async function runTest() {
  try {
    console.log('Testing Backend API...');

    // 1. Health Check
    const health = await axios.get(API_URL);
    console.log('Health Check:', health.data);

    // 2. Start Download (Mock)
    const downloadRes = await axios.post(`${API_URL}/video/download`, {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // Mock URL
    });
    console.log('Download Started:', downloadRes.data);
    const downloadId = downloadRes.data.jobId;

    // 3. Poll Download Status
    let status = 'waiting';
    while (status !== 'completed' && status !== 'failed') {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await axios.get(`${API_URL}/dashboard/status/download/${downloadId}`);
      status = statusRes.data.state;
      console.log(`Download Status (${downloadId}):`, status);
    }

    if (status === 'failed') throw new Error('Download job failed');

    // 4. Start Analyze (Mock)
    const analyzeRes = await axios.post(`${API_URL}/video/analyze`, {
      id: downloadId
    });
    console.log('Analyze Started:', analyzeRes.data);
    const analyzeId = analyzeRes.data.jobId;

    // 5. Poll Analyze Status
    status = 'waiting';
    while (status !== 'completed' && status !== 'failed') {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await axios.get(`${API_URL}/dashboard/status/analyze/${analyzeId}`);
      status = statusRes.data.state;
      console.log(`Analyze Status (${analyzeId}):`, status);
    }
    
    if (status === 'failed') throw new Error('Analyze job failed');

    console.log('All backend tests passed!');
  } catch (error: any) {
    console.error('Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

runTest();
