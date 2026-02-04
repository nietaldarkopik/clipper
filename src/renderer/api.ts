import axios from 'axios';

// Automatically detect base URL:
// - If VITE_API_URL is set (via .env), use it
// - Otherwise, default to relative path (empty string) for same-origin proxy
export const BASE_URL = localStorage.getItem('VITE_API_URL') || import.meta.env.VITE_API_URL || '';
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

export const clipVideo = async (id: string, startTime: number, duration: number, clipId?: string) => {
  const response = await api.post('/editor/clip', { id, startTime, duration, clipId });
  return response.data;
};

export const renderProject = async (projectData: any) => {
  const response = await api.post('/editor/render', projectData);
  return response.data;
};

export const getJobStatus = async (queueName: 'download' | 'analyze' | 'process' | 'upload' | 'auto' | 'render', jobId: string) => {
  const response = await api.get(`/dashboard/status/${queueName}/${jobId}`);
  return response.data;
};

export const uploadVideo = async (filePath: string, platform: string, metadata: any, projectId?: string) => {
  const response = await api.post('/video/upload', { filePath, platform, metadata, projectId });
  return response.data;
};

export const uploadVideoFile = async (file: Blob, filename: string) => {
  const formData = new FormData();
  formData.append('file', file, filename);

  // We use fetch directly here to handle FormData correctly with axios sometimes being tricky with boundary
  // But axios handles it fine usually. Let's use axios instance.
  const response = await api.post('/video/upload-file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
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

export const updateVideo = async (id: string, updates: any) => {
  const response = await api.put(`/library/videos/${id}`, updates);
  return response.data;
};

export const updateVideoStatus = async (id: string, status: string) => {
  return updateVideo(id, { status });
};

export const getTranscript = async (id: string) => {
  const response = await api.get(`/library/videos/${id}/transcript`);
  return response.data;
};

export const getTranscripts = async (id: string) => {
  const response = await api.get(`/library/videos/${id}/transcripts`);
  return response.data.transcripts;
};

export const getLibraryVideos = async () => {
  const response = await api.get('/library/videos');
  return response.data.videos;
};

export const addVideoToProject = async (projectId: string, videoId: string) => {
  const response = await api.post(`/projects/${projectId}/videos/add`, { videoId });
  return response.data;
};

export const generateSummary = async (transcript: string) => {
  const response = await api.post('/ai/generate-summary', { transcript });
  return response.data;
};

export const generateSummaryStream = async (transcript: any[], onChunk: (text: string) => void) => {
  const response = await fetch(`${API_URL}/ai/generate-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Streaming failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('ReadableStream not yet supported in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
  }
};

export const generateScript = async (summary: string, style?: string) => {
  const response = await api.post('/ai/generate-script', { summary, style });
  return response.data;
};

export const generateHighlights = async (transcript: string) => {
  const response = await api.post('/ai/generate-highlights', { transcript });
  return response.data;
};

export const generateSpeech = async (text: string, voice?: string) => {
  const response = await api.post('/ai/generate-speech', { text, voice }, { responseType: 'blob' });
  return response.data;
};

export const mergeClips = async (filePaths: string[], projectId: string, outputName: string) => {
  const response = await api.post('/editor/merge', { filePaths, projectId, outputName });
  return response.data;
};

export const saveClips = async (videoId: string, clips: any[]) => {
  const response = await api.post('/editor/clips/batch', { videoId, clips });
  return response.data;
};

export const deleteClip = async (id: string) => {
  const response = await api.delete(`/library/clips/${id}`);
  return response.data;
};

export const unprocessClip = async (id: string) => {
  const response = await api.post(`/editor/clips/${id}/unprocess`);
  return response.data;
};

// Auto
export const runAutoProcess = async (params: { keyword?: string, count?: number, platform?: string, projectId?: string }) => {
  const response = await api.post('/auto/run', params);
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
