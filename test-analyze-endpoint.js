const axios = require('axios');

async function testAnalyze() {
    const payload = { "id": "57b8ed83-5c73-4ee6-8524-52d29c1e2bd1" };
    const url = 'http://localhost:3000/video/analyze';

    try {
        console.log('Sending analyze request...');
        const response = await axios.post(url, payload);
        console.log('Response:', response.data);

        const jobId = response.data.jobId;
        if (!jobId) {
            console.error('No jobId returned!');
            return;
        }

        console.log(`Polling status for job ${jobId}...`);
        
        // Poll every 2 seconds
        const pollInterval = setInterval(async () => {
            try {
                const statusUrl = `http://localhost:3000/dashboard/status/analyze/${jobId}`;
                const statusResponse = await axios.get(statusUrl);
                const statusData = statusResponse.data;
                
                console.log(`Status: ${statusData.state}, Progress: ${statusData.progress}%`);

                if (statusData.state === 'completed') {
                    console.log('Job Completed!');
                    console.log('Result:', JSON.stringify(statusData.result, null, 2));
                    clearInterval(pollInterval);
                } else if (statusData.state === 'failed') {
                    console.error('Job Failed!');
                    // Note: The status endpoint might not return the error message in 'result', 
                    // but we can try to see if 'failedReason' is available if we modified the endpoint, 
                    // or just check the server logs.
                    // The 'result' field might be null on failure.
                    console.error('Final Status Data:', statusData);
                    clearInterval(pollInterval);
                }
            } catch (err) {
                console.error('Polling error:', err.message);
            }
        }, 2000);

    } catch (error) {
        console.error('Request failed:', error.response ? error.response.data : error.message);
    }
}

testAnalyze();
