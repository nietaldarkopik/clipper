import axios from 'axios';

const API_URL = 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const downloadVideo = async (url: string) => {
  const response = await api.post('/video/download', { url });
  return response.data;
};

export const analyzeVideo = async (id: string) => {
  const response = await api.post('/video/analyze', { id });
  return response.data;
};

export const clipVideo = async (id: string, startTime: number, duration: number) => {
  const response = await api.post('/editor/clip', { id, startTime, duration });
  return response.data;
};

export const getJobStatus = async (queueName: 'download' | 'analyze' | 'process' | 'upload', jobId: string) => {
  const response = await api.get(`/dashboard/status/${queueName}/${jobId}`);
  return response.data;
};

export const uploadVideo = async (filePath: string, platform: string, metadata: any) => {
    const response = await api.post('/video/upload', { filePath, platform, metadata });
    return response.data;
};

export const getTrendingVideos = async (page = 1, limit = 6, source = 'youtube') => {
  const response = await api.get('/research/trending', { params: { page, limit, source } });
  return response.data;
};

export const searchVideos = async (query: string, page = 1, limit = 6, source = 'youtube') => {
  const response = await api.post('/research/search', { query, page, limit, source });
  return response.data;
};

export const generateAIMetadata = async (context: string) => {
  const response = await api.post('/ai/generate-metadata', { context });
  return response.data;
};
