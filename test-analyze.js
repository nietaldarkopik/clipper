
async function testAnalyze() {
    const payload = { "id": "57b8ed83-5c73-4ee6-8524-52d29c1e2bd1" };
    const analyzeUrl = 'http://localhost:3000/video/analyze';
    
    console.log(`Sending POST to ${analyzeUrl} with payload:`, payload);

    try {
        const response = await fetch(analyzeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        console.log('Response:', data);

        if (data.status === 'queued' && data.jobId) {
            console.log(`Job queued with ID: ${data.jobId}. Polling status...`);
            await pollStatus(data.jobId);
        } else {
            console.error('Unexpected response format or job not queued.');
        }

    } catch (error) {
        console.error('Request failed:', error.message);
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
            console.log('Server seems to be down. Please ensure the backend is running (npm run dev).');
        }
    }
}

async function pollStatus(jobId) {
    const statusUrl = `http://localhost:3000/dashboard/status/analyze/${jobId}`;
    
    while (true) {
        try {
            const response = await fetch(statusUrl);
            if (!response.ok) {
                console.error(`Status check failed: ${response.status}`);
                break;
            }

            const data = await response.json();
            const { state, progress, result } = data;
            
            console.log(`Job Status: ${state} | Progress: ${progress}%`);

            if (state === 'completed') {
                console.log('Job Completed Successfully!');
                console.log('Result:', JSON.stringify(result, null, 2));
                break;
            } else if (state === 'failed') {
                console.error('Job Failed.');
                // Try to get error reason if available in result or just stop
                console.log('Full Status Response:', JSON.stringify(data, null, 2));
                break;
            }

            // Wait 2 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error('Polling error:', error.message);
            break;
        }
    }
}

testAnalyze();
