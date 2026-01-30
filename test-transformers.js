
async function test() {
    try {
        console.log('Testing @xenova/transformers import...');
        const transformers = await import('@xenova/transformers');
        console.log('Success importing @xenova/transformers');
        
        console.log('Testing wavefile import...');
        const wavefile = await import('wavefile');
        console.log('Success importing wavefile');

        console.log('Testing pipeline creation...');
        const pipeline = transformers.pipeline;
        // Don't actually download model to save time, just check if pipeline function exists
        if (typeof pipeline === 'function') {
            console.log('Pipeline function is available');
        } else {
            console.error('Pipeline is not a function');
        }

    } catch (error) {
        console.error('Import failed:', error);
    }
}

test();
