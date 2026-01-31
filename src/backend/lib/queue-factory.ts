import { Queue, Worker } from 'bullmq';
import { MockQueue, MockWorker } from './mock-queue';
import { getRedisConnection } from '../redis';

// Auto-detect or force mock.
const USE_MOCK = !process.env.REDIS_HOST;

export const createQueue = (name: string) => {
  if (USE_MOCK) {
    console.log(`[QueueFactory] Using In-Memory MockQueue for '${name}' (Redis not configured)`);
    return new MockQueue(name) as any as Queue;
  }
  console.log(`[QueueFactory] Using Redis Queue for '${name}'`);
  return new Queue(name, { connection: getRedisConnection() });
};

export const createWorker = (name: string, processor: any) => {
  if (USE_MOCK) {
    console.log(`[QueueFactory] Using In-Memory MockWorker for '${name}'`);
    return new MockWorker(name, processor) as any as Worker;
  }
  console.log(`[QueueFactory] Using Redis Worker for '${name}'`);
  return new Worker(name, processor, { connection: getRedisConnection() });
};
