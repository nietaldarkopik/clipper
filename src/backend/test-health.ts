
async function checkHealth() {
    try {
        const res = await fetch('http://127.0.0.1:3001/api/health');
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (err) {
        console.error('Error:', err);
    }
}
checkHealth();
