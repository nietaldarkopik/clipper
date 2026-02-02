const axios = require('axios');

async function debugAutoProcess() {
    const BASE_URL = 'http://localhost:3000/api';
    const keyword = 'polisi';

    try {
        console.log(`1. Requesting auto process for "${keyword}"...`);
        const startRes = await axios.post(`${BASE_URL}/auto/run`, {
            keyword: keyword,
            count: 2,
            platform: 'youtube'
        });

        const jobId = startRes.data.jobId;
        console.log(`   Job ID: ${jobId}`);

        console.log('2. Waiting 3 seconds for job to start/fail...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('3. Fetching job status...');
        const statusRes = await axios.get(`${BASE_URL}/dashboard/status/auto/${jobId}`);

        console.log('--- Full Response ---');
        console.log(JSON.stringify(statusRes.data, null, 2));
        console.log('---------------------');

        if (statusRes.data.error) {
            console.error(`ERROR DETECTED: ${statusRes.data.error}`);
        } else {
            console.log('No error field found in response.');
        }

    } catch (err) {
        if (err.response) {
            console.error(`API Error (${err.response.status}):`, err.response.data);
        } else {
            console.error('Connection Error:', err.message);
        }
    }
}

debugAutoProcess();
