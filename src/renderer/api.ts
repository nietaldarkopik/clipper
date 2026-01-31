import axios from 'axios';

// Automatically detect base URL:
// - If VITE_API_URL is set (via .env), use it
// - Otherwise, default to relative path (empty string) for same-origin proxy
const BASE_URL = localStorage.getItem('VITE_API_URL') || import.meta.env.VITE_API_URL || '';
const API_URL = `${BASE_URL}/api`;

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to update base URL dynamically
export const setApiBaseUrl = (url: string) => {
    localStorage.setItem('VITE_API_URL', url);
    api.defaults.baseURL = `${url}/api`;
};

export const downloadVideo = async (url: string, projectId?: string, downloadSubtitles?: boolean) => {
  const response = await api.post('/video/download', { url, projectId, downloadSubtitles });
  return response.data;
};

export const cancelDownload = async (id: string) => {
  const response = await api.post(`/video/download/${id}/cancel`);
  return response.data;
};

export const retryDownload = async (id: string) => {
  const response = await api.post(`/video/download/${id}/retry`);
  return response.data;
};

export const analyzeVideo = async (id: string, modelSize?: string, method?: 'youtube' | 'whisper') => {
  const response = await api.post('/video/analyze', { id, modelSize, method });
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

// Channels
export const getChannels = async () => {
  const response = await api.get('/channels');
  return response.data;
};

export const addChannel = async (channel: { name: string, platform: string, url: string, description?: string }) => {
  const response = await api.post('/channels', channel);
  return response.data;
};

export const deleteChannel = async (id: string) => {
  const response = await api.delete(`/channels/${id}`);
  return response.data;
};

export const getChannelVideos = async (id: string, limit = 10) => {
  const response = await api.get(`/channels/${id}/videos`, { params: { limit } });
  return response.data;
};

export const getVideo = async (id: string) => {
  const response = await api.get(`/library/videos/${id}`);
  return response.data;
};

export const deleteVideo = async (id: string) => {
  const response = await api.delete(`/library/videos/${id}`);
  return response.data;
};

export const getTranscript = async (id: string) => {
  const response = await api.get(`/library/videos/${id}/transcript`);
  return response.data;
};

// Settings
export const getSettings = async () => {
  const response = await api.get('/settings');
  return response.data;
};

export const updateSettings = async (settings: any) => {
  const response = await api.post('/settings', settings);
  return response.data;
};
