
import { MockQueue } from './src/backend/lib/mock-queue';
import assert from 'assert';

async function test() {
    console.log('Testing MockQueue...');
    const queue = new MockQueue('test');
    
    // Add job
    const job = await queue.add('test-job', { foo: 'bar' }, { jobId: 'job1' });
    console.log('Job added:', job.id);
    
    // Check getJob
    const fetchedJob = await queue.getJob('job1');
    assert.ok(fetchedJob, 'Job should exist');
    assert.strictEqual(fetchedJob?.id, 'job1');
    
    // Check remove
    console.log('Removing job...');
    await fetchedJob?.remove();
    
    const deletedJob = await queue.getJob('job1');
    assert.strictEqual(deletedJob, null, 'Job should be null after removal');
    
    console.log('Test passed!');
}

test().catch(console.error);
