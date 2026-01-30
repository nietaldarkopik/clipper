import { createQueue } from './lib/queue-factory';

export const downloadQueue = createQueue('download');
export const processQueue = createQueue('process');
export const analyzeQueue = createQueue('analyze');
export const uploadQueue = createQueue('upload');
