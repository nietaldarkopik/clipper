import axios from 'axios';

const API_URL = 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export const getTranscripts = async (id: string) => {
  const response = await api.get(`/library/videos/${id}/transcripts`);
  return response.data;
};

// Projects
export const getProjects = async () => {
  const response = await api.get('/projects');
  return response.data;
};

export const getProject = async (id: string) => {
  const response = await api.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (data: { name: string, description?: string }) => {
  const response = await api.post('/projects', data);
  return response.data;
};

export const deleteProject = async (id: string) => {
  const response = await api.delete(`/projects/${id}`);
  return response.data;
};

export const getLibraryVideos = async () => {
    const response = await api.get('/library/videos');
    return response.data;
};

export const addVideoToProject = async (projectId: string, videoId: string) => {
    const response = await api.post(`/projects/${projectId}/videos/add`, { videoId });
    return response.data;
};

export const generateSummary = async (transcript: string) => {
    const response = await api.post('/ai/generate-summary', { transcript });
    return response.data;
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
    const response = await api.post('/ai/generate-speech', { text, voice }, { responseType: 'arraybuffer' });
    return response.data; // Returns ArrayBuffer
};

export const mergeClips = async (filePaths: string[], projectId: string, outputName: string) => {
    const response = await api.post('/editor/merge', { filePaths, projectId, outputName });
    return response.data;
};

export const saveClips = async (clips: any[], videoId: string) => {
    const response = await api.post('/editor/clips/batch', { clips, videoId });
    return response.data;
};

export const deleteClip = async (id: string) => {
    const response = await api.delete(`/editor/clips/${id}`);
    return response.data;
};
