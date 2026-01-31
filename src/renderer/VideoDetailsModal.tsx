import React, { useState, useEffect } from 'react';
import { X, FileText, Film, MessageSquare, Clock, ThumbsUp, Eye, User, Calendar, Loader2, Sparkles } from 'lucide-react';
import { getVideo, getTranscripts, analyzeVideo } from './api';

interface VideoDetailsModalProps {
    videoId: string;
    onClose: () => void;
}

const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const VideoDetailsModal = ({ videoId, onClose }: VideoDetailsModalProps) => {
    const [video, setVideo] = useState<any>(null);
    const [transcripts, setTranscripts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'transcripts' | 'highlights'>('info');

    const fetchData = async () => {
        try {
            const [videoData, transcriptsData] = await Promise.all([
                getVideo(videoId),
                getTranscripts(videoId)
            ]);
            setVideo(videoData);
            setTranscripts(transcriptsData.transcripts || []);
        } catch (error) {
            console.error('Failed to fetch video details:', error);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchData().finally(() => setLoading(false));
    }, [videoId]);

    const handleAnalyze = async () => {
        if (!confirm('This will use local AI resources to transcribe and analyze the video. It may take some time. Continue?')) return;
        
        setAnalyzing(true);
        try {
            await analyzeVideo(videoId);
            alert('Analysis started! Check back in a few minutes.');
            // Ideally poll for status or listen to events
        } catch (error) {
            console.error('Failed to start analysis:', error);
            alert('Failed to start analysis');
        } finally {
            setAnalyzing(false);
        }
    };

    if (!videoId) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
            <div className="bg-[#141414] w-full max-w-5xl h-[90vh] rounded-2xl border border-white/10 flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Film className="text-indigo-500" /> Video Details
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition">
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="animate-spin text-indigo-500" size={40} />
                    </div>
                ) : !video ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        Failed to load video details
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Sidebar */}
                        <div className="w-64 bg-[#0f0f0f] border-r border-white/5 p-4 space-y-2">
                            <button 
                                onClick={() => setActiveTab('info')}
                                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'info' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                <Film size={18} /> Info & Metadata
                            </button>
                            <button 
                                onClick={() => setActiveTab('transcripts')}
                                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'transcripts' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                <FileText size={18} /> Transcripts
                            </button>
                            <button 
                                onClick={() => setActiveTab('highlights')}
                                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'highlights' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                <MessageSquare size={18} /> Highlights
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-[#141414]">
                            {activeTab === 'info' && (
                                <div className="space-y-6">
                                    <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 relative group">
                                        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-contain" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                            <a href={video.url} target="_blank" rel="noreferrer" className="bg-white text-black px-4 py-2 rounded-full font-bold hover:scale-105 transition">
                                                Watch Original
                                            </a>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h1 className="text-2xl font-bold text-white mb-2">{video.title}</h1>
                                        <div className="flex flex-wrap gap-4 text-sm text-slate-400 mb-6">
                                            <div className="flex items-center gap-1"><User size={14} /> {video.uploader || 'Unknown'}</div>
                                            <div className="flex items-center gap-1"><Clock size={14} /> {formatTime(video.duration)}</div>
                                            <div className="flex items-center gap-1"><Eye size={14} /> {Number(video.view_count || 0).toLocaleString()} views</div>
                                            <div className="flex items-center gap-1"><ThumbsUp size={14} /> {Number(video.like_count || 0).toLocaleString()} likes</div>
                                            <div className="flex items-center gap-1"><Calendar size={14} /> {video.upload_date || new Date(video.created_at).toLocaleDateString()}</div>
                                        </div>
                                        
                                        <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/5">
                                            <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Description</h3>
                                            <p className="text-slate-400 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                                                {video.description || 'No description available.'}
                                            </p>
                                        </div>

                                        {video.tags && (
                                            <div className="mt-6">
                                                <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Tags</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {video.tags.map((tag: string, i: number) => (
                                                        <span key={i} className="bg-white/5 text-slate-300 px-2 py-1 rounded text-xs border border-white/5">#{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'transcripts' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-2xl font-bold text-white">Transcripts</h2>
                                        {!transcripts.some(t => t.type === 'whisper') && (
                                            <button 
                                                onClick={handleAnalyze}
                                                disabled={analyzing}
                                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-500 transition disabled:opacity-50"
                                            >
                                                {analyzing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                                Generate Local Transcript
                                            </button>
                                        )}
                                    </div>

                                    {transcripts.length > 0 ? (
                                        transcripts.map((t, idx) => (
                                            <div key={t.id || idx} className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden mb-6">
                                                <div className="bg-[#222] p-4 border-b border-white/5 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${t.type === 'whisper' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-red-500/20 text-red-400'}`}>
                                                            {t.type || 'Unknown'}
                                                        </div>
                                                        <span className="text-slate-400 text-sm">Created: {new Date(t.created_at).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className="p-6 max-h-[400px] overflow-y-auto">
                                                    {t.type === 'youtube' ? (
                                                        <div className="space-y-2">
                                                            {(t.content.events || []).map((event: any, i: number) => (
                                                                <div key={i} className="flex gap-4 text-sm hover:bg-white/5 p-2 rounded">
                                                                    <span className="text-slate-500 font-mono w-16 shrink-0">{formatTime(event.tStartMs / 1000)}</span>
                                                                    <p className="text-slate-300">{(event.segs || []).map((s: any) => s.utf8).join('')}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : t.type === 'whisper' && t.content.segments ? (
                                                        <div className="space-y-2">
                                                            {t.content.segments.map((seg: any, i: number) => (
                                                                <div key={i} className="flex gap-4 text-sm hover:bg-white/5 p-2 rounded">
                                                                    <span className="text-indigo-400 font-mono w-24 shrink-0">
                                                                        {formatTime(seg.start)} - {formatTime(seg.end)}
                                                                    </span>
                                                                    <p className="text-slate-300">{seg.text}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono">
                                                            {JSON.stringify(t.content, null, 2)}
                                                        </pre>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center p-10 text-slate-500 bg-[#1a1a1a] rounded-xl border border-white/5">
                                            <FileText size={40} className="mx-auto mb-4 opacity-20" />
                                            <p>No transcripts available.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'highlights' && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-bold text-white mb-6">Highlights & Clips</h2>
                                    {(video.clips || []).length > 0 ? (
                                        <div className="grid grid-cols-1 gap-4">
                                            {(video.clips || []).map((clip: any) => (
                                                <div key={clip.id} className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 hover:border-indigo-500/50 transition flex items-start gap-4">
                                                    <div className="bg-indigo-900/20 text-indigo-400 p-3 rounded-lg">
                                                        <Film size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <h3 className="font-bold text-white text-lg mb-1">{clip.label || 'Untitled Clip'}</h3>
                                                            <span className="text-xs bg-white/10 px-2 py-1 rounded text-slate-400 font-mono">
                                                                {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-500 mb-3">Duration: {formatTime(clip.end_time - clip.start_time)}</p>
                                                        <div className="flex gap-2">
                                                            {/* Actions can be added here */}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center p-10 text-slate-500 bg-[#1a1a1a] rounded-xl border border-white/5">
                                            <MessageSquare size={40} className="mx-auto mb-4 opacity-20" />
                                            <p>No highlights generated yet.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
