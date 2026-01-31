import React, { useState, useEffect } from 'react';
import { 
  Scissors, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Download, 
  Plus, 
  Trash2, 
  Settings, 
  Video,
  Layers,
  Clock,
  ChevronRight,
  Maximize2,
  Search,
  TrendingUp,
  Youtube,
  Instagram,
  BarChart2,
  ExternalLink,
  Flame,
  Wand2,
  Type,
  Share2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Cpu,
  Palette,
  Check,
  UploadCloud,
  History,
  Hash,
  FileText,
  Tag,
  Loader2,
  ListVideo,
  Folder,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Music,
  Sparkles,
  Users,
  PlusCircle,
  Link,
  Info,
  RefreshCw,
  Square,
  Film
} from 'lucide-react';
import { api, downloadVideo, analyzeVideo, getJobStatus, getTrendingVideos, searchVideos, generateAIMetadata, uploadVideo, getChannels, addChannel, deleteChannel, getChannelVideos, cancelDownload, retryDownload } from './api';
import { VideoDetailsModal } from './VideoDetailsModal';
import { ProjectsTab } from './components/ProjectsTab';
import { SettingsTab } from './components/SettingsTab';

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface LibraryTabProps {
    setCurrentFilePath: (path: string | null) => void;
    setCurrentVideoId: (id: string | null) => void;
    setActiveTab: (tab: string) => void;
    setTranscript: (transcript: any) => void;
    setMetadata: (metadata: any) => void;
}

const LibraryTab = ({ setCurrentFilePath, setCurrentVideoId, setActiveTab, setTranscript, setMetadata }: LibraryTabProps) => {
    const [videos, setVideos] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVideoDetails, setSelectedVideoDetails] = useState<string | null>(null);

    useEffect(() => {
        const fetchVideos = () => {
            api.get('/library/videos')
                .then(res => res.data)
                .then(data => {
                    setVideos(data.videos || []);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setIsLoading(false);
                });
        };

        fetchVideos();
        const interval = setInterval(fetchVideos, 3000);
        return () => clearInterval(interval);
    }, []);

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
             <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-8">
                <Folder className="text-indigo-500" /> Library
             </h2>
             
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
                        <div key={video.id} className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/5 hover:border-indigo-500/50 transition group">
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

                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                    <button className="bg-white text-black p-2 rounded-full hover:scale-110 transition" onClick={() => {
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
                                                        try { content = JSON.parse(content); } catch(e) {}
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
                                onChange={e => setNewChannel({...newChannel, name: e.target.value})}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                placeholder="Channel Name"
                            />
                            <select 
                                value={newChannel.platform}
                                onChange={e => setNewChannel({...newChannel, platform: e.target.value})}
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
                                onChange={e => setNewChannel({...newChannel, url: e.target.value})}
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
                                    if(channel) onUseChannel(channel.url);
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
                                            <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase shadow-sm ${
                                                video.type === 'live' ? 'bg-red-600' :
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
  const [isPlaying, setIsPlaying] = useState(false);
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

  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newZoom = parseInt(e.target.value);
      updateTimeline({ ...timeline, zoom: newZoom });
  };

  const handleDeleteClip = () => {
      if (!timeline.selectedClipId) return;
      const newClips = timeline.clips.filter(c => c.id !== timeline.selectedClipId);
      updateTimeline({ ...timeline, clips: newClips, selectedClipId: null });
  };

  const handleSplitClip = () => {
      if (!timeline.selectedClipId) return;
      const clip = timeline.clips.find(c => c.id === timeline.selectedClipId);
      if (!clip) return;

      // Check if playhead is within clip
      if (timeline.playhead > clip.startTime && timeline.playhead < clip.startTime + clip.duration) {
          const splitPoint = timeline.playhead - clip.startTime;
          
          const leftClip: Clip = {
              ...clip,
              id: Date.now().toString() + '_1',
              duration: splitPoint
          };
          
          const rightClip: Clip = {
              ...clip,
              id: Date.now().toString() + '_2',
              startTime: timeline.playhead,
              duration: clip.duration - splitPoint,
              offset: clip.offset + splitPoint
          };
          
          const newClips = timeline.clips.filter(c => c.id !== clip.id).concat([leftClip, rightClip]);
          updateTimeline({ ...timeline, clips: newClips, selectedClipId: leftClip.id });
      }
  };
  
  const handleTimelineDrop = (e: React.DragEvent, trackId: number) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      
      try {
          const item = JSON.parse(data);
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          const offsetX = e.clientX - rect.left;
          const startTime = Math.max(0, offsetX / timeline.zoom);
          
          const newClip: Clip = {
              id: Date.now().toString(),
              trackId: trackId,
              name: item.name,
              startTime: startTime,
              duration: item.duration || 5, // default 5s if unknown
              offset: 0,
              type: item.type || (trackId === 2 ? 'audio' : trackId === 3 ? 'text' : 'video'),
              color: trackId === 2 ? 'bg-emerald-900/40' : trackId === 3 ? 'bg-orange-900/40' : 'bg-indigo-900/40'
          };
          
          updateTimeline({ ...timeline, clips: [...timeline.clips, newClip] });
      } catch (err) {
          console.error('Drop error:', err);
      }
  };

  // Mock Data untuk Library & History
  const [processingList, setProcessingList] = useState<Array<{id: string, name: string, progress: number, status: string, queueName: string}>>([]);

  useEffect(() => {
    loadTrending();
  }, [researchPage, researchLimit, researchSource]);

  const loadTrending = async () => {
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
    const interval = setInterval(async () => {
      if (processingList.length === 0) return;
      
      const updates = await Promise.all(processingList.map(async (item) => {
        if (['completed', 'failed'].includes(item.status.toLowerCase())) return item;
        try {
           const status = await getJobStatus(item.queueName as any, item.id);
           
           // Auto-detect file path from completed jobs
           if (status.state === 'completed' && status.result) {
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
             status: status.state, 
             progress: status.state === 'completed' ? 100 : (status.progress || item.progress)
           };
        } catch (e) {
           return item;
        }
      }));
      
      if (JSON.stringify(updates) !== JSON.stringify(processingList)) {
        setProcessingList(updates);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [processingList]);

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

  const handleDownload = async (url?: string) => {
    const targetUrl = typeof url === 'string' ? url : searchUrl;
    if (!targetUrl) return;
    setIsDownloading(true);
    try {
      const res = await downloadVideo(targetUrl);
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

  const [uploadHistory] = useState([
    { id: 1, title: 'Tips Sukses 2026', platform: 'TikTok', date: '2 Jam Lalu', views: '12.4K' },
    { id: 2, title: 'Tutorial Masak Kilat', platform: 'IG Reels', date: 'Kemarin', views: '5.2K' }
  ]);

  const [savedClips] = useState([
    { id: 1, label: 'Intro Hook', duration: '00:15' },
    { id: 2, label: 'Action Scene 2', duration: '00:45' },
    { id: 3, label: 'Ending Call to Action', duration: '00:10' }
  ]);

  const [clips, setClips] = useState([
    { id: 1, start: 10, end: 45, label: 'Adegan Intro' },
    { id: 2, start: 60, end: 95, label: 'Highlight Aksi' }
  ]);

  const [captionStyle, setCaptionStyle] = useState({
    color: '#ffffff',
    fontSize: '24',
    style: 'bold',
    effect: 'outline'
  });



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
          {isDownloading || isSearching ? <Loader2 className="animate-spin" /> : (searchUrl.match(/^(http|https|www)/) ? 'Download' : 'Cari')}
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
            <div key={video.id} className="bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden group">
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
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-1 line-clamp-2" title={video.title}>{video.title}</h3>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                  <span>{video.uploader || 'YouTube'} • {video.views ? (video.views / 1000).toFixed(1) + 'K' : 'N/A'} Views</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold transition">
                     Pratinjau
                  </button>
                  <button 
                    className="flex-1 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-[11px] font-bold transition"
                    onClick={() => handleDownload(video.url)}
                  >
                     Download & Clip
                  </button>
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
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#141414] titlebar-drag-region">
        <div className="flex items-center gap-3 text-sm no-drag">
          <span className="font-semibold">VLOG_RAHASIA_SUKSES.mp4</span>
          <span className="text-slate-500">|</span>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold bg-indigo-400/10 px-2 py-1 rounded">
             <CheckCircle2 size={12} /> Video Siap Digabung
          </div>
        </div>
        <div className="flex gap-2 no-drag">
          <button 
            onClick={handleAIAnalyze}
            disabled={isProcessingAI || !currentJobId}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessingAI ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {isProcessingAI ? 'Analyzing...' : 'AI Highlight Detect'}
          </button>
          <button className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold px-4 py-2 rounded-lg transition" onClick={() => setActiveTab('captions')}>
            Lanjut ke Caption
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-row overflow-hidden bg-black">
        <div className="flex-1 flex flex-col items-center justify-center relative group">
           <div className="text-slate-700 flex flex-col items-center gap-4 text-center">
              <Play size={80} fill="currentColor" className="opacity-5" />
              <p className="text-xs font-mono opacity-20 tracking-widest uppercase">Video Monitoring & Timeline</p>
           </div>
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-[#1a1a1a]/80 backdrop-blur-xl px-8 py-3 rounded-full border border-white/10">
              <button className="text-slate-400 hover:text-white"><SkipBack size={20} /></button>
              <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center">
                 {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
              </button>
              <button className="text-slate-400 hover:text-white"><SkipForward size={20} /></button>
           </div>
        </div>
        
        {/* Sidebar Clip & Library */}
        <aside className="w-80 bg-[#141414] border-l border-white/5 flex flex-col">
           <div className="p-4 border-b border-white/5 bg-[#1a1a1a]">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clip Library</h3>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Sedang Diproses */}
              <section>
                 <h4 className="text-[9px] font-bold text-indigo-400 uppercase mb-3 flex items-center gap-2">
                    <Loader2 size={10} className="animate-spin" /> Sedang Diproses
                 </h4>
                 <div className="space-y-2">
                    {processingList.map(item => (
                       <div key={item.id} className="p-2 rounded bg-white/5 border border-white/5">
                          <div className="flex justify-between text-[10px] mb-1.5">
                             <span className="truncate w-32">
                                {item.status === 'completed' || item.progress === 100 ? (
                                    <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={10} /> {item.name.split('...')[0]} Selesai</span>
                                ) : item.name}
                             </span>
                             <span className={item.status === 'completed' || item.progress === 100 ? "text-green-400" : "text-indigo-400"}>
                                {item.status === 'completed' ? '100%' : `${item.progress}%`}
                             </span>
                          </div>
                          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                             <div 
                                className={`h-full transition-all duration-500 ${item.status === 'completed' || item.progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} 
                                style={{ width: `${item.progress}%` }}
                             ></div>
                          </div>
                       </div>
                    ))}
                 </div>
              </section>

              {/* Daftar Klip Terpotong */}
              <section>
                 <h4 className="text-[9px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <ListVideo size={10} /> Koleksi Klip Saya
                 </h4>
                 <div className="space-y-2">
                    {savedClips.map(clip => (
                       <div 
                          key={clip.id} 
                          draggable={true}
                          onDragStart={(e) => {
                              const parts = clip.duration.split(':').map(Number);
                              const durationSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 5;
                              e.dataTransfer.setData('application/json', JSON.stringify({
                                  name: clip.label,
                                  duration: durationSec,
                                  type: 'video'
                              }));
                          }}
                          className="p-2 rounded bg-white/5 border border-white/5 hover:border-indigo-500/30 cursor-grab active:cursor-grabbing flex items-center justify-between group"
                       >
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-[8px] text-slate-500">MP4</div>
                             <div className="flex flex-col">
                                <span className="text-[10px] font-medium">{clip.label}</span>
                                <span className="text-[8px] text-slate-500">{clip.duration}</span>
                             </div>
                          </div>
                          <Plus size={12} className="text-indigo-400 opacity-0 group-hover:opacity-100" />
                       </div>
                    ))}
                 </div>
              </section>
           </div>
        </aside>
      </div>

      <footer className="h-72 bg-[#121212] border-t border-white/5 flex flex-col select-none relative z-20">
         {/* Toolbar Section */}
         <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-[#1a1a1a]">
            <div className="flex items-center gap-4">
               <div className="flex gap-1">
                  <button 
                    onClick={handleUndo} 
                    disabled={historyIndex <= 0}
                    className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition disabled:opacity-30"
                  >
                    <Undo2 size={14}/>
                  </button>
                  <button 
                    onClick={handleRedo} 
                    disabled={historyIndex >= history.length - 1}
                    className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition disabled:opacity-30"
                  >
                    <Redo2 size={14}/>
                  </button>
               </div>
               <div className="w-px h-4 bg-white/10"></div>
               <div className="flex gap-1">
                  <button 
                    onClick={handleSplitClip}
                    disabled={!timeline.selectedClipId}
                    className="px-3 py-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition flex items-center gap-2 text-[10px] font-medium disabled:opacity-30"
                  >
                     <Scissors size={14} /> Split
                  </button>
                  <button 
                    onClick={handleDeleteClip}
                    disabled={!timeline.selectedClipId}
                    className="px-3 py-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition flex items-center gap-2 text-[10px] font-medium disabled:opacity-30"
                  >
                     <Trash2 size={14} /> Delete
                  </button>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <ZoomOut size={14} className="text-slate-500" />
               <input 
                  type="range" 
                  min="5" max="100" step="5"
                  value={timeline.zoom}
                  onChange={handleZoom}
                  className="w-24 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-400" 
               />
               <ZoomIn size={14} className="text-slate-500" />
            </div>
         </div>

         {/* Timeline Area */}
         <div className="flex-1 relative overflow-hidden bg-[#0f0f0f] flex flex-col group">
            {/* Time Ruler */}
            <div className="h-6 border-b border-white/5 flex items-end px-4 text-[9px] text-slate-600 font-mono select-none bg-[#141414] overflow-hidden">
               <div className="flex-1 relative h-full">
                  {[...Array(20)].map((_, i) => (
                      <span key={i} className="absolute bottom-0 text-[8px]" style={{ left: i * 5 * timeline.zoom }}>
                          {formatTime(i * 5)}
                      </span>
                  ))}
               </div>
            </div>

            {/* Tracks Container */}
            <div className="flex-1 p-4 space-y-1 overflow-y-auto relative">
               
               {timeline.tracks.map(track => (
                   <div 
                        key={track.id} 
                        className="h-16 relative group flex mt-2"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleTimelineDrop(e, track.id)}
                   >
                      <div className="w-full bg-white/5 rounded-lg border border-white/5 flex overflow-hidden relative">
                         <div className="absolute left-2 top-1 text-[9px] text-slate-500 z-10 pointer-events-none">{track.name}</div>
                         
                         {timeline.clips.filter(c => c.trackId === track.id).map(clip => (
                             <div 
                                key={clip.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateTimeline({ ...timeline, selectedClipId: clip.id });
                                }}
                                className={`absolute h-[80%] top-[10%] rounded flex flex-col justify-center px-2 cursor-pointer transition border ${
                                    timeline.selectedClipId === clip.id ? 'border-yellow-400 z-20 ring-2 ring-yellow-400/30' : 'border-white/10 hover:border-white/30'
                                } ${clip.color || 'bg-indigo-900/40'}`}
                                style={{
                                    left: clip.startTime * timeline.zoom,
                                    width: clip.duration * timeline.zoom
                                }}
                             >
                                <div className="flex items-center gap-2 text-[10px] text-slate-200 font-medium truncate">
                                   {track.type === 'video' && <Video size={10} />}
                                   {track.type === 'audio' && <Music size={10} />}
                                   {track.type === 'text' && <Type size={10} />}
                                   {clip.name}
                                </div>
                             </div>
                         ))}
                      </div>
                   </div>
               ))}

            </div>

            {/* Playhead */}
            <div 
                className="absolute top-0 bottom-0 w-px bg-white z-30 pointer-events-none group-hover:bg-yellow-400"
                style={{ left: (timeline.playhead * timeline.zoom) + 16 /* padding offset */ }}
            >
               <div className="absolute -top-0 -left-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white"></div>
               <div className="absolute top-0 left-0 w-px h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
            </div>
         </div>
      </footer>
    </div>
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
                            onClick={() => setCaptionStyle({...captionStyle, color: c})}
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
                       onChange={(e) => setCaptionStyle({...captionStyle, fontSize: e.target.value})}
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
                     onChange={(e) => setMetadata({...metadata, title: e.target.value})}
                   />
                </div>

                <div className="space-y-2">
                   <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Deskripsi & Caption</label>
                   <textarea 
                     rows={4}
                     placeholder="Berikan konteks lebih dalam pada video Anda..." 
                     className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 outline-none transition resize-none"
                     value={metadata.description}
                     onChange={(e) => setMetadata({...metadata, description: e.target.value})}
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
                        onChange={(e) => setMetadata({...metadata, hashtags: e.target.value})}
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
                { name: 'TikTok', status: 'Auto-Sync', icon: <Smartphone size={16}/> },
                { name: 'YouTube', status: 'Connected', icon: <Youtube size={16}/> },
                { name: 'Instagram', status: 'Draft Ready', icon: <Instagram size={16}/> }
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
            { id: 'research', icon: <Search size={22} />, title: 'Research' },
            { id: 'channels', icon: <Users size={22} />, title: 'Channels' },
            { id: 'library', icon: <Folder size={22} />, title: 'Library' },
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
            <div className="absolute top-1 left-0 w-full h-8 titlebar-drag-region z-50" />
         )}
         {activeTab === 'projects' && <ProjectsTab />}
         {activeTab === 'research' && ResearchTab()}
         {activeTab === 'channels' && <ChannelsTab onUseChannel={(url) => { setSearchUrl(url); setActiveTab('research'); }} />}
         {activeTab === 'library' && <LibraryTab setCurrentFilePath={setCurrentFilePath} setCurrentVideoId={setCurrentVideoId} setActiveTab={setActiveTab} setTranscript={setTranscript} setMetadata={setMetadata} />}
         {activeTab === 'editor' && EditorTab()}
         {activeTab === 'captions' && CaptionTab()}
         {activeTab === 'publish' && PublishTab()}
         {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};

export default App;
