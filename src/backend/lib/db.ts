import path from 'path';
import fs from 'fs-extra';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
fs.ensureDirSync(path.dirname(dbPath));

// Initialize default data
const defaultData = {
  videos: [],
  transcripts: [],
  clips: [],
  jobs: [],
  upload_history: []
};

if (!fs.existsSync(dbPath)) {
  fs.writeJsonSync(dbPath, defaultData, { spaces: 2 });
}

const readDB = () => {
  try {
    return fs.readJsonSync(dbPath);
  } catch (e) {
    return defaultData;
  }
};

const writeDB = (data: any) => {
  fs.writeJsonSync(dbPath, data, { spaces: 2 });
};

export const initDB = () => {
  console.log('JSON Database initialized at', dbPath);
};

export const getDB = () => readDB();

// Helper to find index
const findIndex = (collection: any[], id: string) => collection.findIndex((item: any) => item.id === id);

// Videos
export const saveVideo = (video: any) => {
  const db = readDB();
  const idx = findIndex(db.videos, video.id);
  const newVideo = { ...video, created_at: video.created_at || new Date().toISOString() };
  if (idx >= 0) {
    db.videos[idx] = { ...db.videos[idx], ...newVideo };
  } else {
    db.videos.push(newVideo);
  }
  writeDB(db);
  return { changes: 1 };
};

export const getVideos = () => {
  const db = readDB();
  return db.videos.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const getVideo = (id: string) => {
  const db = readDB();
  return db.videos.find((v: any) => v.id === id);
};

export const deleteVideo = (id: string) => {
  const db = readDB();
  db.videos = db.videos.filter((v: any) => v.id !== id);
  db.clips = db.clips.filter((c: any) => c.video_id !== id);
  db.transcripts = db.transcripts.filter((t: any) => t.video_id !== id);
  writeDB(db);
  return { changes: 1 };
};

// Transcripts
export const saveTranscript = (transcript: any) => {
  const db = readDB();
  const idx = findIndex(db.transcripts, transcript.id);
  const newT = { ...transcript };
  if (idx >= 0) {
    db.transcripts[idx] = { ...db.transcripts[idx], ...newT };
  } else {
    db.transcripts.push(newT);
  }
  writeDB(db);
  return { changes: 1 };
};

export const getTranscript = (videoId: string) => {
  const db = readDB();
  const t = db.transcripts.find((item: any) => item.video_id === videoId);
  return t;
};

// Clips
export const saveClip = (clip: any) => {
  const db = readDB();
  const idx = findIndex(db.clips, clip.id);
  if (idx >= 0) {
    db.clips[idx] = { ...db.clips[idx], ...clip };
  } else {
    db.clips.push(clip);
  }
  writeDB(db);
  return { changes: 1 };
};

export const getClips = (videoId: string) => {
  const db = readDB();
  return db.clips.filter((c: any) => c.video_id === videoId).sort((a: any, b: any) => a.start_time - b.start_time);
};

export const deleteClip = (id: string) => {
  const db = readDB();
  db.clips = db.clips.filter((c: any) => c.id !== id);
  writeDB(db);
  return { changes: 1 };
};

// Jobs
export const saveJob = (job: any) => {
  const db = readDB();
  const idx = findIndex(db.jobs, job.id);
  const newJob = { ...job, updated_at: new Date().toISOString() };
  if (idx >= 0) {
    db.jobs[idx] = { ...db.jobs[idx], ...newJob };
  } else {
    db.jobs.push(newJob);
  }
  writeDB(db);
  return { changes: 1 };
};

export const getJob = (id: string) => {
  const db = readDB();
  return db.jobs.find((j: any) => j.id === id);
};

// Upload History
export const saveUploadHistory = (history: any) => {
  const db = readDB();
  const idx = findIndex(db.upload_history, history.id);
  if (idx >= 0) {
    db.upload_history[idx] = { ...db.upload_history[idx], ...history };
  } else {
    db.upload_history.push(history);
  }
  writeDB(db);
  return { changes: 1 };
};

export const getUploadHistory = () => {
  const db = readDB();
  return db.upload_history.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};
