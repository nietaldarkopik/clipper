import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Simple in-memory job store
const jobs: Record<string, any> = {};
const queues: Record<string, MockQueue> = {};

export class MockJob {
  id: string;
  data: any;
  name: string;
  progress: number = 0;
  returnvalue: any = null;
  failedReason: string = '';
  _state: 'waiting' | 'active' | 'completed' | 'failed' = 'waiting';
  _finishedOn: number | null = null;
  _processedOn: number | null = null;

  constructor(name: string, data: any, id?: string) {
    this.name = name;
    this.data = data;
    this.id = id || uuidv4();
    jobs[this.id] = this;
  }

  async getState() {
    return this._state;
  }

  async updateProgress(progress: number) {
    this.progress = progress;
  }

  async log(row: string) {
    console.log(`[Job:${this.id}] ${row}`);
  }

  async isActive() {
    return this._state === 'active';
  }

  async isWaiting() {
    return this._state === 'waiting';
  }

  async remove() {
    // Remove from global jobs
    delete jobs[this.id];
    // Remove from queue
    const queue = queues[this.name];
    if (queue) {
        queue.jobs = queue.jobs.filter(j => j.id !== this.id);
    }
  }

  async discard() {
      return this.remove();
  }

  async moveToFailed(err: Error, _token?: string) {
      this._setFailed(err);
  }

  // Internal methods to state change
  _setActive() {
    this._state = 'active';
    this._processedOn = Date.now();
  }

  _setCompleted(result: any) {
    this._state = 'completed';
    this.returnvalue = result;
    this._finishedOn = Date.now();
  }

  _setFailed(err: Error) {
    this._state = 'failed';
    this.failedReason = err.message;
    this._finishedOn = Date.now();
  }
}

export class MockQueue {
  name: string;
  jobs: MockJob[] = [];
  workers: MockWorker[] = [];

  constructor(name: string) {
    this.name = name;
    queues[name] = this;
  }

  async add(name: string, data: any, opts?: { jobId?: string }) {
    const job = new MockJob(name, data, opts?.jobId);
    this.jobs.push(job);
    console.log(`[MockQueue:${this.name}] Added job ${job.id}`);
    
    // Trigger workers
    this._processNext();
    
    return job;
  }

  async getJob(id: string) {
    return jobs[id] || null;
  }

  _processNext() {
    if (this.workers.length === 0) return;
    
    // Find first available worker
    const worker = this.workers.find(w => !w.busy);
    if (!worker) return;

    const waitingJob = this.jobs.find(j => j['_state'] === 'waiting');
    if (!waitingJob) return;

    worker._process(waitingJob);
  }
}

export class MockWorker extends EventEmitter {
  name: string;
  processor: (job: MockJob) => Promise<any>;
  busy: boolean = false;

  constructor(name: string, processor: (job: MockJob) => Promise<any>) {
    super();
    this.name = name;
    this.processor = processor;
    
    // Register with queue
    let queue = queues[name];
    if (!queue) {
      queue = new MockQueue(name);
    }
    queue.workers.push(this);
    queue._processNext();
  }

  async _process(job: MockJob) {
    if (this.busy) return; // Should not happen if queue logic is correct
    
    this.busy = true;
    console.log(`[MockWorker:${this.name}] Processing job ${job.id}`);
    job._setActive();
    
    try {
      const result = await this.processor(job);
      job._setCompleted(result);
      this.emit('completed', job, result);
      console.log(`[MockWorker:${this.name}] Job ${job.id} completed`);
    } catch (err: any) {
      console.error(`[MockWorker:${this.name}] Job ${job.id} failed:`, err);
      job._setFailed(err);
      this.emit('failed', job, err);
    } finally {
        this.busy = false;
        // Trigger next job in queue
        const queue = queues[this.name];
        if (queue) {
            queue._processNext();
        }
    }
  }
}
