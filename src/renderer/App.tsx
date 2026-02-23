import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Scissors,
  Play,
  Download,
  Trash2,
  Settings,
  Video,
  Layers,
  Search,
  TrendingUp,
  Youtube,
  Instagram,
  Wand2,
  Type,
  Share2,
  AlertCircle,
  Smartphone,
  Cpu,
  Palette,
  UploadCloud,
  History,
  Hash,
  FileText,
  Tag,
  Loader2,
  ListVideo,
  Folder,
  Undo2,
  Music,
  Sparkles,
  Users,
  PlusCircle,
  Link,
  Info,
  RefreshCw,
  Square,
  Film,
  Globe,
  ArrowLeft,
  ArrowRight,
  X
} from 'lucide-react';
import { api, downloadVideo, analyzeVideo, getJobStatus, getTrendingVideos, searchVideos, generateAIMetadata, uploadVideo, getChannels, addChannel, deleteChannel, getChannelVideos, cancelDownload, retryDownload } from './api';
import { VideoDetailsModal } from './VideoDetailsModal';
import { ProjectsTab } from './components/ProjectsTab';
import { SettingsTab } from './components/SettingsTab';
import { Recorder } from './components/Recorder';
import { VideoEditor } from './components/VideoEditor/VideoEditor';
import { AutoShortsTab } from './components/AutoShortsTab';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
        src?: string;
        allowpopups?: string;
      };
    }
  }
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface LibraryTabProps {
  videos: any[];
  setVideos: (videos: any[]) => void;
  isLoading: boolean;
  setCurrentFilePath: (path: string | null) => void;
  setCurrentVideoId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  setTranscript: (transcript: any) => void;
  setMetadata: (metadata: any) => void;
}

const LibraryTab = ({ videos, setVideos, isLoading, setCurrentFilePath, setCurrentVideoId, setActiveTab, setTranscript, setMetadata }: LibraryTabProps) => {
  const [selectedVideoDetails, setSelectedVideoDetails] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSelectAll = () => {
    if (selectedIds.length === videos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(videos.map(v => v.id));
    }
  };

  const handleSelectVideo = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(vId => vId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} videos and their related clips/transcripts?`)) return;
    
    setIsDeleting(true);
    try {
      await api.post('/library/videos/bulk-delete', { ids: selectedIds });
      setVideos(videos.filter(v => !selectedIds.includes(v.id)));
      setSelectedIds([]);
    } catch (err) {
      alert('Failed to delete selected videos');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      await api.delete(`/library/videos/${id}`);
      setVideos(videos.filter(v => v.id !== id));
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0f0f0f] p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Folder className="text-indigo-500" /> Library
        </h2>
        <div className="flex gap-3">
          {videos.length > 0 && (
            <button 
              onClick={handleSelectAll}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 hover:bg-[#252525] transition text-sm font-medium text-slate-300"
            >
              {selectedIds.length === videos.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600 hover:text-white transition text-sm font-bold flex items-center gap-2"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Delete ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {selectedVideoDetails && (
        <VideoDetailsModal
          videoId={selectedVideoDetails}
          onClose={() => setSelectedVideoDetails(null)}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {videos.map(video => (
            <div key={video.id} className={`bg-[#1a1a1a] rounded-2xl overflow-hidden border transition group relative ${selectedIds.includes(video.id) ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-white/5 hover:border-indigo-500/50'}`}>
              <div className="absolute top-2 left-2 z-20" onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(video.id)} 
                  onChange={() => handleSelectVideo(video.id)}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer shadow-lg"
                />
              </div>
              <div className="aspect-video bg-black relative">
                {video.thumbnail ? (
                  <img src={video.thumbnail} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-700">
                    <Video size={40} />
                  </div>
                )}

                {/* Downloading Overlay */}
                {video.status === 'downloading' && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                    <Loader2 className="animate-spin text-indigo-500 mb-2" />
                    <div className="w-2/3 bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${video.progress || 0}%` }} />
                    </div>
                    <span className="text-xs text-slate-300 mt-2 mb-3">{Math.round(video.progress || 0)}%</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelDownload(video.id);
                      }}
                      className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/40 transition"
                    >
                      <Square size={10} fill="currentColor" /> Stop
                    </button>
                  </div>
                )}

                {/* Failed/Cancelled Overlay */}
                {(video.status === 'failed' || video.status === 'cancelled') && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                    <AlertCircle className="text-red-500 mb-2" />
                    <span className="text-xs text-red-400 font-bold uppercase mb-3">{video.status}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        retryDownload(video.id);
                      }}
                      className="flex items-center gap-1 text-xs bg-white text-black px-3 py-1.5 rounded-full hover:scale-105 transition font-bold"
                    >
                      <RefreshCw size={12} /> Retry
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(video.id);
                      }}
                      className="mt-2 text-xs text-slate-500 hover:text-white underline"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                  <button
                    className="bg-indigo-600 text-white p-3 rounded-full hover:scale-110 transition shadow-lg"
                    title="Play Video"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVideoDetails(video.id);
                    }}
                  >
                    <Play size={20} fill="currentColor" />
                  </button>
                  <button className="bg-white text-black p-3 rounded-full hover:scale-110 transition shadow-lg" title="Edit & Transcribe" onClick={() => {
                    setCurrentFilePath(video.filepath);
                    setCurrentVideoId(video.id);
                    setTranscript(null); // Clear previous transcript

                    // Set metadata from video record
                    setMetadata({
                      title: video.title || '',
                      description: video.description || '',
                      hashtags: video.hashtags || '',
                      category: video.category || 'Entertainment'
                    });

                    setActiveTab('captions'); // Go to captions to see transcript first, or editor
                    // Let's stick to user flow: usually they want to see result. 
                    // If they ask "where to see transcript", maybe sending them to 'captions' is better?
                    // Or keep 'editor' as default. Let's keep 'editor' but make sure data is loaded.

                    // Fetch transcript if needed
                    api.get(`/library/videos/${video.id}/transcript`)
                      .then(res => res.data)
                      .then(data => {
                        if (data.transcript && data.transcript.content) {
                          // Handle both raw string and JSON content
                          let content = data.transcript.content;
                          if (typeof content === 'string') {
                            try { content = JSON.parse(content); } catch (e) { }
                          }
                          setTranscript(content);
                        } else {
                          setTranscript(null);
                        }
                      })
                      .catch(() => setTranscript(null));
                  }}>
                    <Play size={20} fill="currentColor" />
                  </button>

                  <button className="bg-slate-700 text-white p-2 rounded-full hover:scale-110 transition" onClick={() => setSelectedVideoDetails(video.id)}>
                    <Info size={20} />
                  </button>

                  <button className="bg-red-500 text-white p-2 rounded-full hover:scale-110 transition" onClick={() => handleDelete(video.id)}>
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-sm truncate">{video.title || video.id}</h3>
                <p className="text-[10px] text-slate-500 mt-1 flex justify-between">
                  <span>{new Date(video.created_at).toLocaleDateString()}</span>
                  <span>{video.duration ? formatTime(video.duration) : '--:--'}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ChannelsTab = ({ onUseChannel }: { onUseChannel: (url: string) => void }) => {
  const [channels, setChannels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', platform: 'youtube', url: '', description: '' });
  const [scrapedVideos, setScrapedVideos] = useState<any[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setIsLoading(true);
    try {
      const data = await getChannels();
      setChannels(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannel.name || !newChannel.url) return;

    try {
      await addChannel(newChannel);
      setNewChannel({ name: '', platform: 'youtube', url: '', description: '' });
      setShowAddForm(false);
      loadChannels();
    } catch (e) {
      alert('Failed to add channel');
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteChannel(id);
      loadChannels();
      if (activeChannelId === id) {
        setActiveChannelId(null);
        setScrapedVideos([]);
      }
    } catch (e) {
      alert('Failed to delete');
    }
  };

  const handleScrapeChannel = async (channel: any) => {
    if (activeChannelId === channel.id) {
      // Don't toggle off, just refresh if needed, or maybe do nothing? 
      // Let's allow refreshing by clicking the refresh button, but clicking the card again could just keep it selected.
      // Actually, let's just set it active.
      return;
    }

    setIsScraping(true);
    setActiveChannelId(channel.id);
    setScrapedVideos([]);

    try {
      const videos = await getChannelVideos(channel.id);
      setScrapedVideos(videos);
    } catch (e) {
      console.error(e);
      alert('Failed to fetch videos. Ensure backend is running and yt-dlp is available.');
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-row overflow-hidden bg-[#0f0f0f]">
      {/* Left Side: Channel List */}
      <div className="w-1/3 flex flex-col border-r border-white/5 bg-[#141414]">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="text-indigo-500" /> Channels
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white p-2 rounded-lg transition"
          >
            <PlusCircle size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {showAddForm && (
            <div className="mb-4 bg-[#1a1a1a] p-4 rounded-xl border border-indigo-500/30">
              <h3 className="text-sm font-bold text-white mb-3">Add New Channel</h3>
              <form onSubmit={handleAddChannel} className="space-y-3">
                <input
                  type="text"
                  value={newChannel.name}
                  onChange={e => setNewChannel({ ...newChannel, name: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Channel Name"
                />
                <select
                  value={newChannel.platform}
                  onChange={e => setNewChannel({ ...newChannel, platform: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                </select>
                <input
                  type="text"
                  value={newChannel.url}
                  onChange={e => setNewChannel({ ...newChannel, url: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Channel URL"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-500" /></div>
          ) : (
            channels.map(channel => (
              <div
                key={channel.id}
                onClick={() => handleScrapeChannel(channel)}
                className={`p-4 rounded-xl border cursor-pointer transition group relative ${activeChannelId === channel.id ? 'bg-indigo-900/20 border-indigo-500' : 'bg-[#1a1a1a] border-white/5 hover:border-white/10'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {channel.platform === 'youtube' && <Youtube size={16} className="text-red-500" />}
                    {channel.platform === 'tiktok' && <Music size={16} className="text-pink-500" />}
                    {channel.platform === 'instagram' && <Instagram size={16} className="text-purple-500" />}
                    {channel.platform === 'facebook' && <Share2 size={16} className="text-blue-500" />}
                    <h3 className="font-bold text-white text-sm">{channel.name}</h3>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteChannel(channel.id); }}
                    className="text-slate-600 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 truncate">{channel.url}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Side: Channel Videos */}
      <div className="flex-1 flex flex-col bg-[#0f0f0f]">
        {activeChannelId ? (
          <>
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#141414]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ListVideo className="text-indigo-500" />
                Videos from {channels.find(c => c.id === activeChannelId)?.name}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const channel = channels.find(c => c.id === activeChannelId);
                    if (channel) onUseChannel(channel.url);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2"
                >
                  <Link size={14} /> Open Channel
                </button>
                <button
                  onClick={() => handleScrapeChannel(channels.find(c => c.id === activeChannelId))}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2"
                >
                  <Undo2 size={14} /> Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isScraping ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
                  <Loader2 size={32} className="animate-spin text-indigo-500" />
                  <p>Scraping videos from channel...</p>
                </div>
              ) : scrapedVideos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scrapedVideos.map(video => (
                    <div key={video.id} className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/5 group hover:border-indigo-500/50 transition">
                      <div className="aspect-video bg-black relative">
                        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />

                        {/* Type Badge */}
                        <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase shadow-sm ${video.type === 'live' ? 'bg-red-600' :
                          video.type === 'short' ? 'bg-emerald-600' :
                            'bg-blue-600'
                          }`}>
                          {video.type || 'VIDEO'}
                        </div>

                        {/* Duration */}
                        <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">
                          {video.type === 'live' && (!video.duration || video.duration === 0) ? 'LIVE' : formatTime(Number(video.duration))}
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-bold text-white line-clamp-2 mb-2 h-8" title={video.title}>{video.title}</h4>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-3">
                          <span>{video.views ? Number(video.views).toLocaleString() : 'N/A'} views</span>
                          <span>{video.uploader}</span>
                        </div>
                        <button
                          onClick={() => onUseChannel(video.url)}
                          className="w-full py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"
                        >
                          <Scissors size={14} /> Use for Clip
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <Video size={48} className="opacity-20 mb-4" />
                  <p>No videos found or failed to scrape.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Users size={48} className="opacity-20 mb-4" />
            <p>Select a channel to view videos</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Timeline Types
interface Track {
  id: number;
  type: 'video' | 'audio' | 'text';
  name: string;
}

interface Clip {
  id: string;
  trackId: number;
  name: string;
  startTime: number;
  duration: number;
  offset: number;
  type: 'video' | 'audio' | 'text';
  color: string;
}

interface TimelineState {
  tracks: Track[];
  clips: Clip[];
  zoom: number;
  playhead: number;
  selectedClipId: string | null;
}

const App = () => {
  const [activeTab, setActiveTab] = useState('projects'); // research | editor | captions | publish | projects
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchUrl, setSearchUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [trendingVideos, setTrendingVideos] = useState<any[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<any | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [isVideosLoading, setIsVideosLoading] = useState(true);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectClips, setCurrentProjectClips] = useState<any[]>([]);

  const [quickDownloadUrl, setQuickDownloadUrl] = useState<string | null>(null);
  const [quickDownloadOpen, setQuickDownloadOpen] = useState(false);
  const [quickDownloadProjects, setQuickDownloadProjects] = useState<any[]>([]);
  const [quickDownloadSelectedProjectId, setQuickDownloadSelectedProjectId] = useState<string | null>(null);
  const [quickDownloadLoading, setQuickDownloadLoading] = useState(false);

  // Research Tab State
  const [researchPage, setResearchPage] = useState(1);
  const [researchLimit, setResearchLimit] = useState(6);
  const [researchSource, setResearchSource] = useState('youtube');

  // State untuk Metadata
  const [metadata, setMetadata] = useState({
    title: '',
    description: '',
    hashtags: '',
    category: 'Entertainment',
    targetAudience: 'General'
  });

  // Timeline State & History
  const [history, setHistory] = useState<TimelineState[]>([
    {
      tracks: [
        { id: 1, type: 'video', name: 'Main Video Track' },
        { id: 2, type: 'audio', name: 'Audio Track' },
        { id: 3, type: 'text', name: 'Text/Overlay Track' }
      ],
      clips: [
        { id: 'c1', trackId: 1, name: 'opening_hook.mp4', startTime: 0, duration: 5, offset: 0, type: 'video', color: 'bg-indigo-900/40' },
        { id: 'c2', trackId: 1, name: 'content_main.mp4', startTime: 5, duration: 10, offset: 0, type: 'video', color: 'bg-indigo-900/40' },
        { id: 'c3', trackId: 2, name: 'lofi_chill_bg.mp3', startTime: 0, duration: 15, offset: 0, type: 'audio', color: 'bg-emerald-900/40' },
        { id: 'c4', trackId: 3, name: 'Title Overlay', startTime: 2, duration: 3, offset: 0, type: 'text', color: 'bg-orange-900/40' }
      ],
      zoom: 20,
      playhead: 0,
      selectedClipId: null
    }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const timeline = history[historyIndex];

  const updateTimeline = (newState: TimelineState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1);
  };

  // Mock Data untuk Library & History
  const [processingList, setProcessingList] = useState<Array<{ id: string, name: string, progress: number, status: string, queueName: string }>>([]);
  const processingListRef = useRef<Array<{ id: string, name: string, progress: number, status: string, queueName: string }>>([]);

  useEffect(() => {
    if (activeTab !== 'library') return;

    const fetchVideos = (isBackground = false) => {
      if (!isBackground) setIsVideosLoading(true);
      api.get('/library/videos')
        .then(res => res.data)
        .then(data => {
          setVideos(data.videos || []);
          if (!isBackground) setIsVideosLoading(false);
        })
        .catch(err => {
          console.error(err);
          if (!isBackground) setIsVideosLoading(false);
        });
    };

    fetchVideos(false);
    const interval = setInterval(() => fetchVideos(true), 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const [showRecorder, setShowRecorder] = useState(false);

  useEffect(() => {
    loadTrending();
  }, [researchPage, researchLimit, researchSource]);

  const loadTrending = async () => {
    if (researchSource === 'notebooklm' || researchSource === 'chatgpt' || researchSource === 'deepseek') {
      setTrendingVideos([]);
      return;
    }
    // Only load trending if search is empty
    if (searchUrl && !searchUrl.match(/^(http|https|www)/)) return;

    setIsSearching(true);
    try {
      const res = await getTrendingVideos(researchPage, researchLimit, researchSource);
      setTrendingVideos(res.results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchOrDownload = async () => {
    if (!searchUrl) return;

    // Check if URL
    const isUrl = searchUrl.match(/^(http|https|www)/);

    if (researchSource === 'notebooklm' || researchSource === 'chatgpt' || researchSource === 'deepseek') {
      setIsSearching(true);
      try {
        const res = await searchVideos(searchUrl, 1, researchLimit, researchSource);
        setTrendingVideos(res.results);
      } catch (e) {
        const sourceLabel = researchSource === 'chatgpt' ? 'ChatGPT' : researchSource === 'deepseek' ? 'DeepSeek' : 'NotebookLM';
        alert(`${sourceLabel} search failed`);
      } finally {
        setIsSearching(false);
      }
      return;
    }

    if (isUrl) {
      handleDownload(searchUrl);
    } else {
      // Search
      setIsSearching(true);
      try {
        // Reset page to 1 for new search
        if (researchPage !== 1) setResearchPage(1);

        const res = await searchVideos(searchUrl, researchPage, researchLimit, researchSource);
        setTrendingVideos(res.results);
      } catch (e) {
        alert('Search failed');
      } finally {
        setIsSearching(false);
      }
    }
  };

  useEffect(() => {
    processingListRef.current = processingList;
  }, [processingList]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const currentList = processingListRef.current;
      if (!currentList || currentList.length === 0) return;

      const updates = await Promise.all(currentList.map(async (item) => {
        if (!item || !item.status) return item;
        if (['completed', 'failed'].includes(String(item.status).toLowerCase())) return item;
        try {
          const status = await getJobStatus(item.queueName as any, item.id);

          if (status && status.state === 'completed' && status.result) {
            if (item.queueName === 'download' && status.result.filePath) {
              setCurrentFilePath(status.result.filePath);
            } else if (item.queueName === 'process' && status.result.path) {
              setCurrentFilePath(status.result.path);
            } else if (item.queueName === 'analyze' && status.result.transcript) {
              setTranscript(status.result.transcript);
            }
          }

          return {
            ...item,
            status: status?.state ?? item.status,
            progress: status?.state === 'completed'
              ? 100
              : (status?.progress ?? item.progress)
          };
        } catch (e) {
          return item;
        }
      }));

      if (JSON.stringify(updates) !== JSON.stringify(currentList)) {
        setProcessingList(updates);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleUpload = async () => {
    // Mock path if none exists for testing
    const targetFile = currentFilePath || 'mock_video_path.mp4';
    const platform = 'tiktok'; // Default or from UI

    setIsUploading(true);
    try {
      const res = await uploadVideo(targetFile, platform, metadata);
      setProcessingList(prev => [...prev, { id: res.jobId, name: `Uploading to ${platform}...`, progress: 0, status: 'waiting', queueName: 'upload' }]);
      alert('Upload started! Check activity status.');
    } catch (error) {
      console.error(error);
      alert('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartDownload = async (targetUrl: string, projectId?: string) => {
    if (!targetUrl) return;
    setIsDownloading(true);
    try {
      const res = await downloadVideo(targetUrl, projectId);
      setCurrentJobId(res.jobId);
      setProcessingList(prev => [...prev, { id: res.jobId, name: `Downloading ${targetUrl.slice(0, 20)}...`, progress: 0, status: 'waiting', queueName: 'download' }]);
      // alert(`Download started! Job ID: ${res.jobId}`);
    } catch (error) {
      console.error(error);
      alert('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownload = async (url?: string) => {
    const targetUrl = typeof url === 'string' ? url : searchUrl;
    if (!targetUrl) return;
    await handleStartDownload(targetUrl);
  };

  const handleAIAnalyze = async () => {
    // Prioritize currentVideoId (from Library) then currentJobId (from fresh download)
    const idToAnalyze = currentVideoId || currentJobId;

    if (!idToAnalyze) {
      alert("Silakan pilih video dari Library terlebih dahulu!");
      return;
    }

    setIsProcessingAI(true);
    try {
      const res = await analyzeVideo(idToAnalyze);
      setProcessingList(prev => [...prev, { id: res.jobId, name: 'AI Analysis (Whisper & Highlights)...', progress: 0, status: 'waiting', queueName: 'analyze' }]);
    } catch (error) {
      console.error(error);
      alert('Analysis failed');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const openQuickDownload = async (url: string) => {
    if (!url) return;
    setQuickDownloadUrl(url);
    setQuickDownloadOpen(true);
    setQuickDownloadLoading(true);
    try {
      const res = await api.get('/projects');
      const data = Array.isArray(res.data) ? res.data : (res.data?.projects || []);
      setQuickDownloadProjects(data);
      if (data.length > 0) {
        setQuickDownloadSelectedProjectId(data[0].id);
      } else {
        setQuickDownloadSelectedProjectId(null);
      }
    } catch (e) {
      alert('Gagal memuat daftar project');
    } finally {
      setQuickDownloadLoading(false);
    }
  };

  const confirmQuickDownload = async () => {
    if (!quickDownloadUrl) return;
    setQuickDownloadOpen(false);
    await handleStartDownload(quickDownloadUrl, quickDownloadSelectedProjectId || undefined);
    setQuickDownloadUrl(null);
  };

  const handleAIGenerate = async () => {
    const context = metadata.title || metadata.description || "Video viral trending topic hari ini";
    setIsGeneratingAI(true);
    try {
      const res = await generateAIMetadata(context);
      setMetadata(prev => ({
        ...prev,
        title: res.title,
        description: res.description,
        hashtags: res.hashtags.join(' '),
        category: res.category
      }));
    } catch (e) {
      console.error(e);
      alert('Gagal generate AI Metadata. Pastikan API Key valid.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleOpenEditor = (clips: any[], projectId?: string) => {
    if (projectId) setCurrentProjectId(projectId);
    setCurrentProjectClips(clips);

    // Convert backend clips to timeline clips
    const newTimelineClips = clips.map((clip, index) => {
      let duration = 5;
      if (typeof clip.duration === 'string') {
        const parts = clip.duration.split(':').map(Number);
        duration = parts.length === 2 ? parts[0] * 60 + parts[1] : 5;
      } else if (typeof clip.duration === 'number') {
        duration = clip.duration;
      } else if (clip.end_time && clip.start_time) {
        duration = clip.end_time - clip.start_time;
      }

      return {
        id: Date.now().toString() + index,
        trackId: 1, // Main video track
        name: clip.label || `Clip ${index + 1}`,
        startTime: timeline.clips.length > 0 ? Math.max(...timeline.clips.map(c => c.startTime + c.duration)) : 0, // Append to end
        duration: duration,
        offset: 0,
        type: 'video' as const,
        color: 'bg-indigo-900/40'
      };
    });

    const updatedClips = [...timeline.clips, ...newTimelineClips];
    updateTimeline({ ...timeline, clips: updatedClips });
    setActiveTab('editor');
  };

  const [uploadHistory] = useState([
    { id: 1, title: 'Tips Sukses 2026', platform: 'TikTok', date: '2 Jam Lalu', views: '12.4K' },
    { id: 2, title: 'Tutorial Masak Kilat', platform: 'IG Reels', date: 'Kemarin', views: '5.2K' }
  ]);

  const [savedClips] = useState([
    { id: 1, label: 'Intro Hook', duration: '00:15' },
    { id: 2, label: 'Action Scene 2', duration: '00:45' },
    { id: 3, label: 'Ending Call to Action', duration: '00:10' }
  ]);

  const editorClips = [
    ...savedClips,
    ...videos.map(v => ({
      id: v.id,
      label: v.title || v.id,
      duration: v.duration ? formatTime(v.duration) : '00:00',
      filepath: v.filepath
    }))
  ];

  const [captionStyle, setCaptionStyle] = useState({
    color: '#ffffff',
    fontSize: '24',
    style: 'bold',
    effect: 'outline'
  });

  const BrowserTab = () => {
    const [browserUrl, setBrowserUrl] = useState('https://www.youtube.com');
    const [currentUrl, setCurrentUrl] = useState('https://www.youtube.com');
    const [browserTabs, setBrowserTabs] = useState<{ id: number; title: string; url: string }[]>([
      { id: 1, title: 'YouTube', url: 'https://www.youtube.com' }
    ]);
    const [activeBrowserTabId, setActiveBrowserTabId] = useState(1);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const webviewRef = useRef<any>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const isElectron = typeof window !== 'undefined' && (window as any).process && (window as any).process.versions && (window as any).process.versions.electron;

    const isSocialUrl = useMemo(() => {
      if (!currentUrl) return false;
      const url = currentUrl.toLowerCase();
      return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('tiktok.com') || url.includes('instagram.com') || url.includes('twitter.com') || url.includes('x.com') || url.includes('facebook.com');
    }, [currentUrl]);

    useEffect(() => {
      const target = browserUrl || 'https://www.youtube.com';
      setBrowserUrl(target);
      setCurrentUrl(target);
      setBrowserTabs(prev => prev.map(tab => tab.id === activeBrowserTabId ? { ...tab, url: target } : tab));
      if (isElectron && webviewRef.current) {
        webviewRef.current.src = target;
      } else if (iframeRef.current) {
        iframeRef.current.src = target;
      }
    }, []);

    useEffect(() => {
      if (!isElectron || !webviewRef.current) return;
      const view = webviewRef.current as any;

      const handleDidNavigate = (event: any) => {
        if (event && event.url) {
          const url = event.url;
          setCurrentUrl(url);
          setBrowserTabs(prev =>
            prev.map(tab =>
              tab.id === activeBrowserTabId ? { ...tab, url } : tab
            )
          );
          setBrowserUrl(url);
        }
      };

      const handleDidNavigateInPage = (event: any) => {
        if (event && event.url) {
          const url = event.url;
          setCurrentUrl(url);
          setBrowserTabs(prev =>
            prev.map(tab =>
              tab.id === activeBrowserTabId ? { ...tab, url } : tab
            )
          );
          setBrowserUrl(url);
        }
      };

      const handleDidStartLoading = () => {
        setIsPageLoading(true);
      };

      const handleDidStopLoading = () => {
        setIsPageLoading(false);
        try {
          setCanGoBack(typeof view.canGoBack === 'function' ? view.canGoBack() : false);
          setCanGoForward(typeof view.canGoForward === 'function' ? view.canGoForward() : false);
        } catch {
          setCanGoBack(false);
          setCanGoForward(false);
        }
      };

      view.addEventListener('did-navigate', handleDidNavigate);
      view.addEventListener('did-navigate-in-page', handleDidNavigateInPage);
      view.addEventListener('did-start-loading', handleDidStartLoading);
      view.addEventListener('did-stop-loading', handleDidStopLoading);

      return () => {
        view.removeEventListener('did-navigate', handleDidNavigate);
        view.removeEventListener('did-navigate-in-page', handleDidNavigateInPage);
        view.removeEventListener('did-start-loading', handleDidStartLoading);
        view.removeEventListener('did-stop-loading', handleDidStopLoading);
      };
    }, [isElectron, activeBrowserTabId]);
    
    const normalizeUrl = (target: string) => {
      if (!target) return '';
      let finalUrl = target.trim();
      if ((finalUrl.startsWith('`') && finalUrl.endsWith('`')) ||
          (finalUrl.startsWith('"') && finalUrl.endsWith('"')) ||
          (finalUrl.startsWith("'") && finalUrl.endsWith("'"))) {
        finalUrl = finalUrl.slice(1, -1).trim();
      }
      finalUrl = finalUrl.replace(/^['"`]+/, '').replace(/['"`]+$/, '').trim();
      const spaceIndex = finalUrl.indexOf(' ');
      if (spaceIndex > 0) {
        finalUrl = finalUrl.slice(0, spaceIndex);
      }
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      }
      return finalUrl;
    };

    const handleNavigate = (target: string) => {
      const finalUrl = normalizeUrl(target);
      if (!finalUrl) return;
      setBrowserUrl(finalUrl);
      setCurrentUrl(finalUrl);
      setBrowserTabs(prev =>
        prev.map(tab =>
          tab.id === activeBrowserTabId ? { ...tab, url: finalUrl } : tab
        )
      );
      if (isElectron && webviewRef.current) {
        webviewRef.current.src = finalUrl;
      } else if (iframeRef.current) {
        iframeRef.current.src = finalUrl;
      }
    };

    const handleBack = () => {
      if (!isElectron || !webviewRef.current) return;
      try {
        if (webviewRef.current.canGoBack()) {
          webviewRef.current.goBack();
        }
      } catch {}
    };

    const handleForward = () => {
      if (!isElectron || !webviewRef.current) return;
      try {
        if (webviewRef.current.canGoForward()) {
          webviewRef.current.goForward();
        }
      } catch {}
    };

    const handleReload = () => {
      if (isElectron && webviewRef.current) {
        try {
          webviewRef.current.reload();
        } catch {}
      } else if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src;
      }
    };

    const handleOpenProjectModal = async () => {
      if (!currentUrl) return;
      setIsLoadingProjects(true);
      try {
        const res = await api.get('/projects');
        const data = Array.isArray(res.data) ? res.data : (res.data?.projects || []);
        setProjects(data);
        setShowProjectModal(true);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        } else {
          setSelectedProjectId(null);
        }
      } catch (e) {
        alert('Gagal memuat daftar project');
      } finally {
        setIsLoadingProjects(false);
      }
    };

    const handleConfirmDownload = async () => {
      if (!currentUrl) return;
      setShowProjectModal(false);
      await handleStartDownload(currentUrl, selectedProjectId || undefined);
    };

    const handleSwitchBrowserTab = (id: number) => {
      setActiveBrowserTabId(id);
      const target = browserTabs.find(tab => tab.id === id);
      if (!target) return;
      setBrowserUrl(target.url);
      setCurrentUrl(target.url);
      if (isElectron && webviewRef.current) {
        webviewRef.current.src = target.url;
      } else if (iframeRef.current) {
        iframeRef.current.src = target.url;
      }
    };

    const handleNewBrowserTab = () => {
      const nextId = browserTabs.length ? Math.max(...browserTabs.map(t => t.id)) + 1 : 1;
      const url = 'https://www.google.com';
      const nextTabs = [...browserTabs, { id: nextId, title: 'New Tab', url }];
      setBrowserTabs(nextTabs);
      setActiveBrowserTabId(nextId);
      setBrowserUrl(url);
      setCurrentUrl(url);
      if (isElectron && webviewRef.current) {
        webviewRef.current.src = url;
      } else if (iframeRef.current) {
        iframeRef.current.src = url;
      }
    };

    const handleCloseBrowserTab = (id: number) => {
      if (browserTabs.length === 1) return;
      const filtered = browserTabs.filter(tab => tab.id !== id);
      setBrowserTabs(filtered);
      if (activeBrowserTabId === id) {
        const next = filtered[filtered.length - 1];
        setActiveBrowserTabId(next.id);
        setBrowserUrl(next.url);
        setCurrentUrl(next.url);
        if (isElectron && webviewRef.current) {
          webviewRef.current.src = next.url;
        } else if (iframeRef.current) {
          iframeRef.current.src = next.url;
        }
      }
    };

    return (
      <div className="flex-1 flex flex-col bg-[#0f0f0f] min-h-0">
        <div className="h-16x border-b border-white/5 bg-[#141414] px-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
              <Globe size={18} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-1 bg-[#0b0b0b] rounded-xl px-2 py-1 border border-white/10 overflow-x-auto">
                {browserTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleSwitchBrowserTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[11px] whitespace-nowrap ${tab.id === activeBrowserTabId ? 'bg-white text-black' : 'bg-transparent text-slate-300 hover:bg-white/10'}`}
                  >
                    <span className="max-w-[120px] truncate">{tab.title || tab.url}</span>
                    {browserTabs.length > 1 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseBrowserTab(tab.id);
                        }}
                        className="text-slate-500 hover:text-slate-900 text-[10px]"
                      >
                        ×
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={handleNewBrowserTab}
                  className="ml-1 w-6 h-6 flex items-center justify-center rounded-fullx bg-white/5 text-slate-200 hover:bg-white/20 text-xs border border-danger"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  disabled={!isElectron || !canGoBack}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-center ${!isElectron || !canGoBack ? 'border-white/10 text-slate-600' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  onClick={handleForward}
                  disabled={!isElectron || !canGoForward}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-center ${!isElectron || !canGoForward ? 'border-white/10 text-slate-600' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}
                >
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={handleReload}
                  className="p-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 flex items-center justify-center"
                >
                  <RefreshCw size={16} />
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={browserUrl}
                    onChange={(e) => setBrowserUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNavigate(browserUrl);
                    }}
                    placeholder="Masukkan URL, contoh: https://www.youtube.com/"
                    className="w-full bg-[#0b0b0b] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  {isPageLoading && (
                    <Loader2 size={14} className="animate-spin text-indigo-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                <button
                  onClick={() => handleNavigate(browserUrl)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 flex items-center gap-2"
                >
                  Pergi
                </button>
                <button
                  onClick={handleOpenProjectModal}
                  disabled={!isSocialUrl || isDownloading}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${!isSocialUrl || isDownloading ? 'bg-white/10 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                >
                  {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  <span>Download Video</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-black">
          {isElectron ? (
            <webview
              ref={webviewRef}
              src={browserUrl}
              allowpopups="true"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <iframe
              ref={iframeRef}
              src={browserUrl}
              className="w-full h-full border-0 bg-black"
            />
          )}
        </div>
        {showProjectModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Pilih Project</div>
                  <div className="text-[11px] text-slate-500">Video akan di-download dan dimasukkan ke project ini.</div>
                </div>
                <button
                  onClick={() => setShowProjectModal(false)}
                  className="text-slate-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Memuat project...</span>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Belum ada project. Buat project di tab Projects terlebih dahulu.
                  </div>
                ) : (
                  projects.map((project: any) => (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left border ${selectedProjectId === project.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/10 text-slate-300 hover:border-indigo-500/50'}`}
                    >
                      <span>{project.name}</span>
                    </button>
                  ))
                )}
                <button
                  onClick={() => setSelectedProjectId(null)}
                  className={`w-full mt-2 flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${selectedProjectId === null ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-slate-400 hover:border-emerald-500/50'}`}
                >
                  <span>Tanpa Project (hanya ke Library)</span>
                </button>
              </div>
              <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmDownload}
                  disabled={isDownloading || !currentUrl}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-50"
                >
                  Mulai Download
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- SUB-HALAMAN: RESEARCH ---
  const ResearchTab = () => (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0f0f0f] p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Search className="text-indigo-500" /> Research & Discovery
          </h2>
          <p className="text-slate-400 text-sm mt-1">Cari tren otomatis atau berdasarkan kata kunci.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition">
            <Cpu size={18} /> AI Auto-Discovery
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex gap-2">
          <select
            className="bg-[#1a1a1a] border border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-indigo-500 text-slate-300"
            value={researchSource}
            onChange={(e) => { setResearchSource(e.target.value); setResearchPage(1); }}
          >
            <option value="youtube">YouTube</option>
            <option value="notebooklm">NotebookLM</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="deepseek">DeepSeek</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="twitter">X (Twitter)</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Masukkan URL Video atau Kata Kunci Pencarian..."
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500"
            value={searchUrl}
            onChange={(e) => setSearchUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchOrDownload()}
          />
        </div>
        <button
          className="bg-white/5 hover:bg-white/10 px-6 rounded-xl text-sm font-medium border border-white/5 transition"
          onClick={() => handleSearchOrDownload()}
          disabled={isDownloading || isSearching}
        >
          {isDownloading || isSearching ? <Loader2 className="animate-spin" /> : (researchSource === 'notebooklm' ? 'Buat Notebook' : ((researchSource === 'chatgpt' || researchSource === 'deepseek') ? 'Riset' : (searchUrl.match(/^(http|https|www)/) ? 'Download' : 'Cari')))}
        </button>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Show per page:</span>
          <select
            className="bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500 text-slate-300"
            value={researchLimit}
            onChange={(e) => { setResearchLimit(Number(e.target.value)); setResearchPage(1); }}
          >
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 bg-white/5 rounded-lg text-xs disabled:opacity-50 hover:bg-white/10"
            onClick={() => setResearchPage(p => Math.max(1, p - 1))}
            disabled={researchPage === 1 || isSearching}
          >
            Prev
          </button>
          <span className="text-xs text-slate-400">Page {researchPage}</span>
          <button
            className="px-3 py-1 bg-white/5 rounded-lg text-xs disabled:opacity-50 hover:bg-white/10"
            onClick={() => setResearchPage(p => p + 1)}
            disabled={isSearching || trendingVideos.length < researchLimit}
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isSearching && trendingVideos.length === 0 ? (
          <div className="col-span-3 flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
        ) : trendingVideos.length > 0 ? (
          trendingVideos.map((video) => (
            <div
              key={video.id}
              className="bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden group"
              onContextMenu={(e) => {
                e.preventDefault();
                if (video.url) openQuickDownload(video.url);
              }}
            >
              {video.source === 'notebooklm' || video.source === 'chatgpt' || video.source === 'deepseek' ? (
                <div className="h-44 bg-slate-900 relative flex items-center justify-center overflow-hidden">
                  <div className="text-slate-400 text-xs px-4 text-center">{video.source === 'chatgpt' ? 'ChatGPT' : (video.source === 'deepseek' ? 'DeepSeek' : 'NotebookLM')}</div>
                </div>
              ) : (
              <div className="h-44 bg-slate-800 relative flex items-center justify-center overflow-hidden">
                {video.thumbnail ? (
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-slate-600 text-xs">No Thumbnail</span>
                )}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
                  {video.duration ? formatTime(video.duration) : '??:??'}
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                  <button className="p-3 bg-white text-black rounded-full hover:scale-110 transition" onClick={() => handleDownload(video.url)}><Download size={20} /></button>
                  <button className="p-3 bg-indigo-600 text-white rounded-full hover:scale-110 transition" onClick={() => handleDownload(video.url)}><Scissors size={20} /></button>
                </div>
              </div>
              )}
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-1 line-clamp-2" title={video.title}>{video.title}</h3>
                {video.source === 'chatgpt' && (
                  <p className="text-[11px] text-slate-400 mb-2 line-clamp-3">{video.summary}</p>
                )}
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                  <span>{video.source === 'notebooklm' ? 'NotebookLM' : (video.source === 'chatgpt' ? 'ChatGPT' : (video.source === 'deepseek' ? 'DeepSeek' : (video.uploader || 'YouTube')))} • {video.source === 'notebooklm' ? 'Notebook' : ((video.source === 'chatgpt' || video.source === 'deepseek') ? 'Ringkasan' : (video.views ? (video.views / 1000).toFixed(1) + 'K' : 'N/A') + ' Views')}</span>
                </div>
                <div className="flex gap-2">
                  {video.source === 'notebooklm' ? (
                    <>
                      <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold transition" onClick={() => window.open(video.url, '_blank')}>
                        Buka Notebook
                      </button>
                      <button
                        className="flex-1 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-[11px] font-bold transition"
                        onClick={() => navigator.clipboard.writeText(video.url)}
                      >
                        Salin Link
                      </button>
                    </>
                  ) : (video.source === 'chatgpt' || video.source === 'deepseek') ? (
                    <>
                      <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold transition" onClick={() => navigator.clipboard.writeText(`${video.title}\n\n${video.summary || ''}`)}>
                        Salin Ringkasan
                      </button>
                      <button
                        className="flex-1 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-[11px] font-bold transition"
                        onClick={() => setSearchUrl(video.title)}
                      >
                        Gunakan Judul
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold transition">
                        Pratinjau
                      </button>
                      <button
                        className="flex-1 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-[11px] font-bold transition"
                        onClick={() => handleDownload(video.url)}
                      >
                        Download & Clip
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center text-slate-500 py-20">
            {isSearching ? 'Mencari...' : 'Tidak ada hasil ditemukan. Coba kata kunci lain.'}
          </div>
        )}
      </div>
    </div>
  );

  // --- SUB-HALAMAN: EDITOR ---
  const EditorTab = () => (
    <VideoEditor
      timeline={timeline}
      updateTimeline={updateTimeline}
      historyIndex={historyIndex}
      historyLength={history.length}
      handleUndo={handleUndo}
      handleRedo={handleRedo}
      savedClips={editorClips}
      projectClips={currentProjectClips}
      projectId={currentProjectId}
      processingList={processingList}
      handleAIAnalyze={handleAIAnalyze}
      isProcessingAI={isProcessingAI}
      onContinue={() => setActiveTab('captions')}
    />
  );



  // --- SUB-HALAMAN: CAPTION EDITOR ---
  const CaptionTab = () => (
    <div className="flex-1 flex flex-row overflow-hidden bg-[#0f0f0f]">
      <div className="flex-1 flex flex-col items-center justify-center p-12 relative">
        <div className="w-[300px] aspect-[9/16] bg-slate-900 rounded-[2.5rem] border-[8px] border-[#222] relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 flex flex-col items-center justify-end p-8 text-center bg-gradient-to-t from-black/60 to-transparent">
            <p
              className="drop-shadow-lg transition-all duration-300 px-4 py-2 rounded-lg"
              style={{
                color: captionStyle.color,
                fontSize: `${captionStyle.fontSize}px`,
                fontWeight: captionStyle.style === 'bold' ? 'bold' : 'normal',
                WebkitTextStroke: captionStyle.effect === 'outline' ? '1.5px black' : 'none',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
              }}
            >
              "Inilah cara rahasia sukses di tahun 2026!"
            </p>
          </div>
        </div>
        <p className="mt-6 text-[10px] text-slate-500 uppercase tracking-[0.2em]">Smartphone Preview Mode</p>
      </div>

      <aside className="w-[400px] bg-[#141414] border-l border-white/5 flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/5 bg-[#1a1a1a]">
          <h2 className="text-lg font-bold flex items-center gap-2"><Type className="text-indigo-500" /> AI Auto-Caption</h2>
          <p className="text-xs text-slate-500 mt-1">Sesuaikan gaya teks agar lebih menarik.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
              <Palette size={12} /> Kustomisasi Visual
            </h3>
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="text-[10px] text-slate-400">Pilihan Warna Utama</label>
                <div className="flex gap-3">
                  {['#ffffff', '#facc15', '#ef4444', '#4ade80', '#38bdf8'].map(c => (
                    <button
                      key={c}
                      onClick={() => setCaptionStyle({ ...captionStyle, color: c })}
                      className={`w-8 h-8 rounded-xl border-2 transition-transform active:scale-90 ${captionStyle.color === c ? 'border-indigo-500 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400">Ukuran Font</label>
                  <span className="text-[10px] font-mono text-indigo-400">{captionStyle.fontSize}px</span>
                </div>
                <input
                  type="range" min="16" max="48"
                  value={captionStyle.fontSize}
                  onChange={(e) => setCaptionStyle({ ...captionStyle, fontSize: e.target.value })}
                  className="w-full accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest flex items-center justify-between">
              <span className="flex items-center gap-2"><FileText size={12} /> Edit Transkrip</span>
              <div className="flex gap-2">
                {!transcript && (
                  <button
                    onClick={handleAIAnalyze}
                    disabled={isProcessingAI}
                    className="text-[9px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                  >
                    {isProcessingAI ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    Generate (Whisper)
                  </button>
                )}
                <button
                  onClick={handleAIAnalyze}
                  disabled={isProcessingAI}
                  className="text-[9px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                  title="Analyze Highlights based on Transcript"
                >
                  {isProcessingAI ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                  Analyze Highlights
                </button>
              </div>
            </h3>

            {!transcript && !isProcessingAI && (
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center mb-4">
                <p className="text-[10px] text-indigo-300 mb-2">Transkrip belum tersedia.</p>
                <p className="text-[9px] text-slate-500">Klik "Generate" untuk membuat transkrip otomatis menggunakan Whisper AI.</p>
              </div>
            )}

            <div className="space-y-3">
              {(transcript?.segments ? transcript.segments.map((s: any) => ({
                t: formatTime(s.start),
                s: s.text
              })) : (transcript ? [] : [
                { t: "00:00", s: "Contoh transkrip..." },
              ])).map((item: any, idx: number) => (
                <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 focus-within:border-indigo-500/50 transition-all flex gap-3">
                  <span className="text-[10px] font-mono text-indigo-400 mt-0.5">{item.t}</span>
                  <textarea
                    className="flex-1 bg-transparent text-[11px] text-slate-200 focus:outline-none resize-none leading-relaxed"
                    rows={2}
                    defaultValue={item.s}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="p-6 bg-[#1a1a1a] border-t border-white/5">
          <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-2xl transition shadow-xl shadow-indigo-500/20 active:scale-[0.98]" onClick={() => setActiveTab('publish')}>
            Terapkan & Atur Metadata
          </button>
        </div>
      </aside>
    </div>
  );

  // --- SUB-HALAMAN: PUBLISH & HISTORY ---
  const PublishTab = () => (
    <div className="flex-1 flex flex-row overflow-hidden bg-[#0f0f0f]">
      {/* Bagian Kiri: Editor Metadata */}
      <div className="flex-1 overflow-y-auto p-10 space-y-10">
        <section className="max-w-2xl">
          <h2 className="text-2xl font-bold mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UploadCloud className="text-indigo-500" /> Publikasi Konten
            </div>
            <button
              onClick={handleAIGenerate}
              disabled={isGeneratingAI}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {isGeneratingAI ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
              Generate with AI
            </button>
          </h2>

          <div className="space-y-6 bg-[#1a1a1a] p-8 rounded-[2.5rem] border border-white/5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Judul Video</label>
              <input
                type="text"
                placeholder="Tulis judul yang menarik..."
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 outline-none transition"
                value={metadata.title}
                onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Deskripsi & Caption</label>
              <textarea
                rows={4}
                placeholder="Berikan konteks lebih dalam pada video Anda..."
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 outline-none transition resize-none"
                value={metadata.description}
                onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                  <Hash size={12} /> Hashtag Viral
                </label>
                <input
                  type="text"
                  placeholder="#tips #vlog #viral"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 outline-none transition"
                  value={metadata.hashtags}
                  onChange={(e) => setMetadata({ ...metadata, hashtags: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                  <Tag size={12} /> Kategori Meta
                </label>
                <select className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 outline-none transition appearance-none">
                  <option>Entertainment</option>
                  <option>Educational</option>
                  <option>Gaming</option>
                  <option>Tech & AI</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <button className="flex-1 bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-200 transition active:scale-95 shadow-lg">
                <Download size={20} /> Simpan Manual
              </button>
              <button
                className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-indigo-500 transition active:scale-95 shadow-xl shadow-indigo-500/20 disabled:opacity-50"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Share2 size={20} />}
                {isUploading ? 'Uploading...' : 'Upload Sekarang'}
              </button>
            </div>
          </div>
        </section>

        {/* Social Media Status */}
        <section className="max-w-2xl grid grid-cols-3 gap-4">
          {[
            { name: 'TikTok', status: 'Auto-Sync', icon: <Smartphone size={16} /> },
            { name: 'YouTube', status: 'Connected', icon: <Youtube size={16} /> },
            { name: 'Instagram', status: 'Draft Ready', icon: <Instagram size={16} /> }
          ].map(p => (
            <div key={p.name} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">{p.icon}</div>
              <div>
                <p className="text-[10px] font-bold">{p.name}</p>
                <p className="text-[8px] text-green-400 font-mono tracking-widest uppercase">{p.status}</p>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Bagian Kanan: History & Dashboard */}
      <aside className="w-[380px] border-l border-white/5 bg-[#141414] p-8 overflow-y-auto">
        <div className="mb-10">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-6">
            <History size={18} className="text-slate-500" /> Riwayat Upload
          </h3>
          <div className="space-y-4">
            {uploadHistory.map(item => (
              <div key={item.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-xs font-bold truncate w-40">{item.title}</h4>
                  <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">BERHASIL</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>{item.platform}</span>
                    <span>•</span>
                    <span>{item.date}</span>
                  </div>
                  <div className="flex items-center gap-1 text-indigo-400">
                    <TrendingUp size={10} /> {item.views}
                  </div>
                </div>
              </div>
            ))}
            <button className="w-full py-3 text-[10px] font-bold text-slate-500 hover:text-white transition border border-dashed border-white/10 rounded-xl">
              Lihat Semua Riwayat
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-6">
            <AlertCircle size={18} className="text-amber-500" /> Aktivitas Saat Ini
          </h3>
          <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-4 text-[10px]">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                <Loader2 size={18} className="animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-200">Menyatukan Klip & AI</p>
                <p className="text-slate-500">84% Selesai</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#0f0f0f] text-slate-200 font-sans overflow-hidden select-none">
      {/* Sidebar Navigasi Utama */}
      <aside className="w-20 flex flex-col items-center py-10 bg-[#1a1a1a] border-r border-white/5 space-y-12 relative">
        <div className="absolute top-0 left-0 w-full h-8 titlebar-drag-region" />
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 cursor-pointer hover:rotate-6 transition-transform z-10">
          <Video size={26} className="text-white" />
        </div>
        <nav className="flex flex-col space-y-10">
          {[
            { id: 'projects', icon: <Film size={22} />, title: 'Projects' },
            { id: 'browser', icon: <Globe size={22} />, title: 'Browser' },
            { id: 'research', icon: <Search size={22} />, title: 'Research' },
            { id: 'channels', icon: <Users size={22} />, title: 'Channels' },
            { id: 'library', icon: <Folder size={22} />, title: 'Library' },
            { id: 'autoShorts', icon: <Sparkles size={22} />, title: 'Auto Shorts' },
            { id: 'editor', icon: <Layers size={22} />, title: 'Editor' },
            { id: 'captions', icon: <Type size={22} />, title: 'Captions' },
            { id: 'publish', icon: <Share2 size={22} />, title: 'Publish' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative flex flex-col items-center gap-2 transition-all ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-600 hover:text-white'}`}
            >
              {tab.icon}
              <span className="text-[8px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-5">{tab.title}</span>
              {activeTab === tab.id && <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-600 rounded-r-full shadow-[4px_0_15px_rgba(79,70,229,0.7)]"></div>}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col space-y-8">
          <button
            onClick={() => setShowRecorder(true)}
            className="group relative flex flex-col items-center gap-2 transition-all text-red-500 hover:text-red-400"
            title="Record Video"
          >
            <Video size={20} />
          </button>
          <button className="group relative flex flex-col items-center gap-2 transition-all text-slate-600 hover:text-white"><History size={20} /></button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`group relative flex flex-col items-center gap-2 transition-all ${activeTab === 'settings' ? 'text-indigo-400' : 'text-slate-600 hover:text-white'}`}
          >
            <Settings size={20} />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">JD</div>
        </div>
      </aside>

      {/* Kontainer Aplikasi */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab !== 'editor' && (
          <div className="absolutex top-1 left-0 w-full h-8 titlebar-drag-region z-50" />
        )}
        {activeTab === 'projects' && <ProjectsTab onOpenEditor={(clips) => handleOpenEditor(clips)} />}
        {activeTab === 'browser' && <BrowserTab />}
        {activeTab === 'research' && ResearchTab()}
        {activeTab === 'channels' && <ChannelsTab onUseChannel={(url) => { setSearchUrl(url); setActiveTab('research'); }} />}
        {activeTab === 'library' && <LibraryTab videos={videos} setVideos={setVideos} isLoading={isVideosLoading} setCurrentFilePath={setCurrentFilePath} setCurrentVideoId={setCurrentVideoId} setActiveTab={setActiveTab} setTranscript={setTranscript} setMetadata={setMetadata} />}
        {activeTab === 'autoShorts' && <AutoShortsTab />}
        {activeTab === 'editor' && EditorTab()}
        {activeTab === 'captions' && CaptionTab()}
        {activeTab === 'publish' && PublishTab()}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {quickDownloadOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Pilih Project</div>
                <div className="text-[11px] text-slate-500">Video akan di-download dan dimasukkan ke project ini.</div>
              </div>
              <button
                onClick={() => setQuickDownloadOpen(false)}
                className="text-slate-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {quickDownloadLoading ? (
                <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Memuat project...</span>
                </div>
              ) : quickDownloadProjects.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  Belum ada project. Buat project di tab Projects terlebih dahulu.
                </div>
              ) : (
                quickDownloadProjects.map((project: any) => (
                  <button
                    key={project.id}
                    onClick={() => setQuickDownloadSelectedProjectId(project.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left border ${quickDownloadSelectedProjectId === project.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/10 text-slate-300 hover:border-indigo-500/50'}`}
                  >
                    <span>{project.name}</span>
                  </button>
                ))
              )}
              <button
                onClick={() => setQuickDownloadSelectedProjectId(null)}
                className={`w-full mt-2 flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${quickDownloadSelectedProjectId === null ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-slate-400 hover:border-emerald-500/50'}`}
              >
                <span>Tanpa Project (hanya ke Library)</span>
              </button>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setQuickDownloadOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Batal
              </button>
              <button
                onClick={confirmQuickDownload}
                disabled={isDownloading || !quickDownloadUrl}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-50"
              >
                Mulai Download
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecorder && (
        <Recorder
          onClose={() => setShowRecorder(false)}
          onSaved={() => {
            setShowRecorder(false);
            setActiveTab('library');
          }}
        />
      )}
    </div>
  );
};

export default App;
