import React, { useState, useEffect, useRef } from 'react';
import {
    Scissors,
    Trash2,
    Undo2,
    Redo2,
    ZoomIn,
    ZoomOut,
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Music,
    Type,
    Video,
    Plus,
    Loader2,
    CheckCircle2,
    Monitor,
    Layers,
    Wand2,
    Sticker,
    Filter,
    Settings2,
    Sparkles,
    Volume2,
    Maximize2,
    Ghost,
    Layout,
    Download,
    Folder
} from 'lucide-react';

import {
    startCaptionJob,
    getCaptionJobStatus,
    renderCaptionVideo,
    getRenderJobStatus,
    CAPTION_API_URL
} from '../../api';

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
    thumbnail?: string;
    filepath?: string;
}

interface TimelineState {
    tracks: Track[];
    clips: Clip[];
    zoom: number;
    playhead: number;
    selectedClipId: string | null;
}

interface VideoEditorProps {
    timeline: TimelineState;
    updateTimeline: (newState: TimelineState) => void;
    historyIndex: number;
    historyLength: number;
    handleUndo: () => void;
    handleRedo: () => void;
    savedClips: any[];
    projectClips: any[];
    projectId: string | null;
    processingList: any[];
    handleAIAnalyze: () => void;
    isProcessingAI: boolean;
    onContinue: () => void;
}

export const VideoEditor = ({
    timeline,
    updateTimeline,
    historyIndex,
    historyLength,
    handleUndo,
    handleRedo,
    savedClips,
    projectClips,
    projectId,
    processingList,
    handleAIAnalyze,
    isProcessingAI,
    onContinue
}: VideoEditorProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeSecondaryTab, setActiveSecondaryTab] = useState('media'); // media, audio, text, stickers, effects, filters, adjustments
    const [activeInspectorTab, setActiveInspectorTab] = useState('video'); // video, audio, speed, animation
    const [aspectRatio, setAspectRatio] = useState<'16/9' | '9/16' | '1/1'>('16/9');
    const [clipTransforms, setClipTransforms] = useState<Record<string, { scale: number, x: number, y: number, opacity: number }>>({});
    const timelineRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Captioning State
    const [isCaptioning, setIsCaptioning] = useState(false);
    const [captions, setCaptions] = useState<any[]>([]);
    const [captionJobId, setCaptionJobId] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);
    const [renderJobId, setRenderJobId] = useState<string | null>(null);
    const [renderStatus, setRenderStatus] = useState<string>("");
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

    const captionStyles: Record<string, any> = {
        simple: { font: "Arial", size: 24, color: "#FFFFFF", stroke: "#000000", position: "bottom", label: "Simple" },
        youtube: { font: "Roboto", size: 32, color: "#FFFF00", stroke: "#000000", position: "bottom", bold: true, label: "YouTube" },
        tiktok: { font: "Montserrat", size: 48, color: "#FFFFFF", stroke: "#000000", position: "middle", bold: true, background: true, label: "TikTok" },
        karaoke: { font: "Comic Sans MS", size: 36, color: "#00FFFF", stroke: "#0000CC", position: "bottom", italic: true, label: "Karaoke" },
        minimal: { font: "Helvetica", size: 20, color: "#CCCCCC", stroke: "", position: "bottom", label: "Minimal" }
    };
    const [selectedStyleKey, setSelectedStyleKey] = useState("simple");

    const handleAutoCaption = async () => {
        const videoClip = timeline.clips.find(c => c.type === 'video');
        if (!videoClip) {
            alert("Please add a video to the timeline first.");
            return;
        }

        setIsCaptioning(true);
        try {
            let fileToUpload: File | string = videoClip.filepath || "";
            
            if (fileToUpload.startsWith('blob:') || fileToUpload.startsWith('http')) {
                 const res = await fetch(fileToUpload);
                 const blob = await res.blob();
                 fileToUpload = new File([blob], "video.mp4", { type: "video/mp4" });
            } 
            
            const job = await startCaptionJob(fileToUpload);
            setCaptionJobId(job.job_id);
            if (job.video_id) {
                setCurrentVideoId(job.video_id);
            }
            
            const interval = setInterval(async () => {
                try {
                    const status = await getCaptionJobStatus(job.job_id);
                    if (status.status === 'completed') {
                        clearInterval(interval);
                        setCaptions(status.result.segments);
                        setIsCaptioning(false);
                        
                        const newClips = status.result.segments.map((seg: any, index: number) => ({
                            id: `caption_${Date.now()}_${index}`,
                            trackId: 2, 
                            name: seg.text,
                            startTime: seg.start,
                            duration: seg.end - seg.start,
                            offset: 0,
                            type: 'text',
                            color: 'bg-orange-600/40'
                        }));
                        
                        const otherClips = timeline.clips.filter(c => c.type !== 'text');
                        updateTimeline({ ...timeline, clips: [...otherClips, ...newClips] });
                        
                    } else if (status.status === 'failed') {
                        clearInterval(interval);
                        setIsCaptioning(false);
                        alert("Captioning failed: " + status.error);
                    }
                } catch (e) {
                    console.error(e);
                    clearInterval(interval);
                    setIsCaptioning(false);
                }
            }, 1000);
            
        } catch (error) {
            console.error("Captioning error:", error);
            setIsCaptioning(false);
            alert("Failed to start captioning. Ensure backend is running.");
        }
    };

    const handleRenderCaptionedVideo = async () => {
        if (!currentVideoId) {
            alert("Please run Auto Caption first to upload the video.");
            return;
        }
        
        const textClips = timeline.clips.filter(c => c.type === 'text').sort((a, b) => a.startTime - b.startTime);
        const segments = textClips.map(c => ({
            start: c.startTime,
            end: c.startTime + c.duration,
            text: c.name
        }));
        
        if (segments.length === 0) {
            alert("No captions to render.");
            return;
        }

        setIsRendering(true);
        setRenderStatus("Starting render...");
        setDownloadUrl(null);
        
        try {
            const style = captionStyles[selectedStyleKey] || captionStyles.simple;
            const job = await renderCaptionVideo(currentVideoId, segments, style);
            setRenderJobId(job.job_id);
            
            const interval = setInterval(async () => {
                try {
                    const status = await getRenderJobStatus(job.job_id);
                    if (status.status === 'completed') {
                        clearInterval(interval);
                        setIsRendering(false);
                        setRenderStatus("Render complete!");
                        setDownloadUrl(`${CAPTION_API_URL}${status.result.video_url}`);
                    } else if (status.status === 'failed') {
                        clearInterval(interval);
                        setIsRendering(false);
                        setRenderStatus("Render failed: " + status.error);
                    } else {
                        setRenderStatus(`Rendering... (${status.status})`);
                    }
                } catch (e) {
                    console.error(e);
                    clearInterval(interval);
                    setIsRendering(false);
                    setRenderStatus("Error checking status");
                }
            }, 2000);

        } catch (e) {
             console.error(e);
             setIsRendering(false);
             setRenderStatus("Failed to start render");
        }
    };
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
    };

    const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateTimeline({ ...timeline, zoom: parseInt(e.target.value) });
    };

    const handleDeleteClip = () => {
        if (!timeline.selectedClipId) return;
        const updatedClips = timeline.clips.filter(c => c.id !== timeline.selectedClipId);
        updateTimeline({ ...timeline, clips: updatedClips, selectedClipId: null });
    };

    const handleSplitClip = () => {
        if (!timeline.selectedClipId) return;
        const clip = timeline.clips.find(c => c.id === timeline.selectedClipId);
        if (!clip) return;

        const relativePlayhead = timeline.playhead - clip.startTime;
        if (relativePlayhead <= 0 || relativePlayhead >= clip.duration) return;

        const clip1 = { ...clip, duration: relativePlayhead, id: clip.id + '_1' };
        const clip2 = { ...clip, startTime: timeline.playhead, duration: clip.duration - relativePlayhead, offset: clip.offset + relativePlayhead, id: clip.id + '_2' };

        const updatedClips = timeline.clips.filter(c => c.id !== clip.id);
        updatedClips.push(clip1, clip2);

        updateTimeline({ ...timeline, clips: updatedClips, selectedClipId: clip2.id });
    };

    const handleTimelineDrop = (e: React.DragEvent, trackId: number) => {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
            const dropTime = Math.max(0, x / timeline.zoom);

            const newClip: Clip = {
                id: Date.now().toString(),
                trackId,
                name: data.name,
                startTime: dropTime,
                duration: data.duration,
                offset: data.offset || 0,
                type: data.type,
                color: data.type === 'video' ? 'bg-indigo-600/40' : (data.type === 'audio' ? 'bg-emerald-600/40' : 'bg-orange-600/40'),
                filepath: data.filepath
            };

            const updatedClips = [...timeline.clips, newClip];
            updateTimeline({ ...timeline, clips: updatedClips, selectedClipId: newClip.id });
        } catch (err) {
            console.error("Drop error:", err);
        }
    };

    const handleTimelineClick = (e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
        const clickTime = Math.max(0, (x - 112) / timeline.zoom); // 112 = 96 (label) + 16 (padding)
        updateTimeline({ ...timeline, playhead: clickTime, selectedClipId: null });
    };

    // Auto-scroll playhead into view when playing
    useEffect(() => {
        let interval: any;
        if (isPlaying) {
            interval = setInterval(() => {
                const nextPlayhead = timeline.playhead + 0.1;
                updateTimeline({ ...timeline, playhead: nextPlayhead });
                // Sync video if it exists
                if (videoRef.current) {
                    const currentClip = timeline.clips.find(c =>
                        c.trackId === 1 &&
                        nextPlayhead >= c.startTime &&
                        nextPlayhead < c.startTime + c.duration
                    );
                    if (currentClip) {
                        const videoTime = (nextPlayhead - currentClip.startTime) + (currentClip.offset || 0);
                        if (Math.abs(videoRef.current.currentTime - videoTime) > 0.2) {
                            videoRef.current.currentTime = videoTime;
                        }
                    }
                }
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying, timeline.playhead, timeline.clips]);

    const getSelectedTransform = () => {
        if (!timeline.selectedClipId) return { scale: 1, x: 0, y: 0, opacity: 100 };
        return clipTransforms[timeline.selectedClipId] || { scale: 1, x: 0, y: 0, opacity: 100 };
    };

    const updateTransform = (key: string, value: number) => {
        if (!timeline.selectedClipId) return;
        setClipTransforms(prev => ({
            ...prev,
            [timeline.selectedClipId!]: {
                ...getSelectedTransform(),
                [key]: value
            }
        }));
    };

    const getVideoUrl = (filepath: string) => {
        if (!filepath) return '';
        if (filepath.startsWith('http')) return filepath;
        const filename = filepath.split(/[\\/]/).pop();
        return `http://localhost:3001/processed/${filename}`;
    };

    const currentClipForPreview = timeline.clips.find(c =>
        c.trackId === 1 &&
        timeline.playhead >= c.startTime &&
        timeline.playhead < c.startTime + c.duration
    );

    const secondaryNav = [
        { id: 'media', icon: <Video size={18} />, label: 'Media' },
        { id: 'audio', icon: <Music size={18} />, label: 'Audio' },
        { id: 'text', icon: <Type size={18} />, label: 'Text' },
        { id: 'stickers', icon: <Sticker size={18} />, label: 'Stickers' },
        { id: 'effects', icon: <Wand2 size={18} />, label: 'Effects' },
        { id: 'transitions', icon: <Layers size={18} />, label: 'Transitions' },
        { id: 'filters', icon: <Filter size={18} />, label: 'Filters' },
        { id: 'adjustment', icon: <Settings2 size={18} />, label: 'Adjustment' },
    ];

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a] text-slate-200">
            {/* Top Toolbar */}
            <header className="h-12 border-b border-white/5 flex items-center justify-between px-4 bg-[#111] z-30">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded text-xs font-medium">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span>Auto saved: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono tracking-widest uppercase flex items-center gap-2">
                        <Folder className="text-indigo-500" size={12} />
                        {projectId ? `PROJECT: ${projectId.slice(0, 8)}` : 'NO PROJECT'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAIAnalyze}
                        disabled={isProcessingAI}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition flex items-center gap-2"
                    >
                        {isProcessingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        AI Highlight Detect
                    </button>
                    <button
                        onClick={onContinue}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition flex items-center gap-2"
                    >
                        <Layout size={12} />
                        Export
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Sidebar + Panel */}
                <div className="flex flex-row w-[40%] min-w-[450px] border-r border-white/5 bg-[#141414]">
                    {/* Tiny Sidebar icons */}
                    <div className="w-16 flex flex-col items-center py-4 gap-6 border-r border-white/5 bg-[#111]">
                        {secondaryNav.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSecondaryTab(item.id)}
                                className={`flex flex-col items-center gap-1 transition ${activeSecondaryTab === item.id ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {item.icon}
                                <span className="text-[9px] font-medium">{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Secondary Panel Content */}
                    <div className="flex-1 flex flex-col p-4 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold capitalize">{activeSecondaryTab}</h3>
                            <div className="relative">
                                <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                                <input
                                    type="text"
                                    placeholder={`Search ${activeSecondaryTab}...`}
                                    className="bg-white/5 border border-white/10 rounded-md py-1 pl-7 pr-2 text-[10px] focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                            {activeSecondaryTab === 'media' && (
                                <>
                                    {projectClips.length > 0 && (
                                        <section className="space-y-3">
                                            <h4 className="text-[9px] font-bold text-orange-400 uppercase tracking-widest flex items-center gap-2">
                                                Project Clips
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                {projectClips.map((clip) => (
                                                    <div
                                                        key={clip.id}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            const parts = (clip.duration || "0:05").split(':').map(Number);
                                                            const durationSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 5;
                                                            e.dataTransfer.setData('application/json', JSON.stringify({
                                                                name: clip.label || clip.name,
                                                                duration: durationSec,
                                                                type: 'video',
                                                                filepath: clip.filepath,
                                                                offset: 0
                                                            }));
                                                        }}
                                                        className="group relative h-24 bg-orange-900/20 rounded-lg overflow-hidden border border-orange-500/20 hover:border-orange-500/50 transition cursor-grab"
                                                    >
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                            <Video size={32} />
                                                        </div>
                                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-[9px] backdrop-blur-sm">
                                                            <p className="truncate font-medium">{clip.label || clip.name}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {processingList.length > 0 && (
                                        <section className="space-y-3">
                                            <h4 className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                                <Loader2 size={10} className="animate-spin" /> In Progress
                                            </h4>
                                            <div className="space-y-2">
                                                {processingList.map(item => (
                                                    <div key={item.id} className="p-2 rounded bg-white/5 border border-white/5">
                                                        <div className="flex justify-between text-[10px] mb-1.5">
                                                            <span className="truncate w-32">{item.name}</span>
                                                            <span className="text-indigo-400">{item.progress}%</span>
                                                        </div>
                                                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${item.progress}%` }}></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    <section>
                                        <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Library</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {savedClips.map((clip) => (
                                                <div
                                                    key={clip.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        const parts = (clip.duration || "0:01").split(':').map(Number);
                                                        const durationSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 5;
                                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                                            name: clip.label,
                                                            duration: durationSec,
                                                            type: 'video',
                                                            filepath: clip.filepath,
                                                            offset: 0
                                                        }));
                                                    }}
                                                    className="group relative h-24 bg-slate-800/50 rounded-lg overflow-hidden border border-white/5 hover:border-indigo-500 transition cursor-grab"
                                                >
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition">
                                                        <Video size={32} />
                                                    </div>
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-[9px] backdrop-blur-sm border-t border-white/5">
                                                        <p className="truncate font-medium">{clip.label}</p>
                                                        <p className="text-slate-400">{clip.duration}</p>
                                                    </div>
                                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
                                                        <button className="p-1 bg-indigo-600 rounded">
                                                            <Plus size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button className="h-24 bg-white/5 rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition group">
                                                <Plus className="text-slate-500 group-hover:text-indigo-400" size={20} />
                                                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Import</span>
                                            </button>
                                        </div>
                                    </section>
                                </>
                            )}

                            {activeSecondaryTab === 'text' && (
                                <div className="space-y-6">
                                    <section>
                                        <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Auto Caption</h4>
                                        <button 
                                            onClick={handleAutoCaption}
                                            disabled={isCaptioning}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
                                        >
                                            {isCaptioning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            {isCaptioning ? "Generating..." : "Generate Captions"}
                                        </button>
                                        {captions.length > 0 && (
                                            <p className="text-[10px] text-emerald-500 mt-2 flex items-center gap-1">
                                                <CheckCircle2 size={10} /> Generated {captions.length} captions
                                            </p>
                                        )}
                                    </section>

                                    <section>
                                        <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Style Template</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.keys(captionStyles).map((styleKey) => (
                                                <button
                                                    key={styleKey}
                                                    onClick={() => setSelectedStyleKey(styleKey)}
                                                    className={`h-20 rounded-lg border flex flex-col items-center justify-center gap-1 transition relative ${selectedStyleKey === styleKey ? 'bg-indigo-600/20 border-indigo-500' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                                                >
                                                    <Type size={20} className={selectedStyleKey === styleKey ? 'text-indigo-400' : 'text-slate-500'} />
                                                    <span className="text-[10px] font-medium">{captionStyles[styleKey].label}</span>
                                                    {selectedStyleKey === styleKey && (
                                                        <div className="absolute top-1 right-1 text-indigo-500">
                                                            <CheckCircle2 size={10} />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Export</h4>
                                        <button 
                                            onClick={handleRenderCaptionedVideo}
                                            disabled={isRendering || !currentVideoId}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
                                        >
                                            {isRendering ? <Loader2 size={14} className="animate-spin" /> : <Monitor size={14} />}
                                            {isRendering ? "Rendering..." : "Burn Captions & Export"}
                                        </button>
                                        {renderStatus && (
                                            <p className="text-[10px] text-slate-400 mt-2 text-center">{renderStatus}</p>
                                        )}
                                        {downloadUrl && (
                                            <a 
                                                href={downloadUrl} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="block mt-2 text-center text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
                                            >
                                                Download Video
                                            </a>
                                        )}
                                    </section>
                                </div>
                            )}

                            {activeSecondaryTab === 'effects' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {['Fisheye', 'Shake', 'Blur', 'Edge Glow', 'Oblique Blur', 'Blurry Focus', 'Zoom Lens', 'Arrow'].map(effect => (
                                        <div key={effect} className="space-y-2">
                                            <div className="h-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-white/5 overflow-hidden flex items-center justify-center relative hover:border-indigo-500 cursor-pointer transition">
                                                <Ghost className="text-slate-700 opacity-50" size={32} />
                                                <div className="absolute bottom-1 right-1 bg-black/50 p-1 rounded">
                                                    <Download size={10} />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-center text-slate-400">{effect}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Center: Video Player */}
                <div className="flex-1 flex flex-col bg-black relative">
                    <div className="h-10 border-b border-white/5 flex items-center px-4 bg-[#141414] text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Player
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div
                            className={`bg-slate-900/40 rounded shadow-2xl overflow-hidden border border-white/5 relative group transition-all duration-300`}
                            style={{
                                aspectRatio: aspectRatio === '16/9' ? '16/9' : aspectRatio === '9/16' ? '9/16' : '1/1',
                                height: 'auto',
                                width: '100%',
                                maxWidth: aspectRatio === '9/16' ? '300px' : 'none'
                            }}
                        >
                            {/* Real Video Preview */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black">
                                {currentClipForPreview?.filepath ? (
                                    <video
                                        ref={videoRef}
                                        src={getVideoUrl(currentClipForPreview.filepath)}
                                        className="w-full h-full object-contain"
                                        style={{
                                            transform: (() => {
                                                const t = clipTransforms[currentClipForPreview.id] || { scale: 1, x: 0, y: 0 };
                                                return `scale(${t.scale}) translate(${t.x}px, ${t.y}px)`;
                                            })(),
                                            opacity: (clipTransforms[currentClipForPreview.id]?.opacity || 100) / 100
                                        }}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-4 text-center opacity-10 group-hover:opacity-20 transition">
                                        <Play size={100} fill="currentColor" />
                                        <p className="text-sm font-mono tracking-widest uppercase">Video Monitor</p>
                                    </div>
                                )}
                            </div>

                            {/* Dynamic Resize Box (UI Flavor) */}
                            {timeline.selectedClipId && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border-2 border-dashed border-indigo-500/40 pointer-events-none">
                                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-indigo-500 rounded-full"></div>
                                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-indigo-500 rounded-full"></div>
                                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-indigo-500 rounded-full"></div>
                                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-indigo-500 rounded-full"></div>
                                    <div className="absolute top-2 left-2 bg-indigo-600 px-2 py-0.5 rounded text-[8px] text-white">SELECTED CLIP</div>
                                </div>
                            )}
                        </div>

                        {/* Player Controls */}
                        <div className="mt-4 w-full max-w-2xl flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                <span className="text-indigo-400">{formatTime(timeline.playhead)}</span>
                                <span>/</span>
                                <span>{formatTime(Math.max(10, ...timeline.clips.map(c => c.startTime + c.duration)))}</span>
                            </div>

                            <div className="w-full flex items-center justify-between">
                                <div className="flex gap-4">
                                    <button className="text-slate-400 hover:text-white transition"><SkipBack size={18} /></button>
                                    <button
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition active:scale-95"
                                    >
                                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                                    </button>
                                    <button className="text-slate-400 hover:text-white transition"><SkipForward size={18} /></button>
                                </div>

                                <div className="flex gap-4 items-center">
                                    <button className="text-slate-400 hover:text-white"><Volume2 size={16} /></button>
                                    <select
                                        className="bg-transparent border-none text-[10px] text-slate-400 focus:outline-none cursor-pointer"
                                        value={aspectRatio}
                                        onChange={(e) => setAspectRatio(e.target.value as any)}
                                    >
                                        <option value="16/9">Ratio 16:9</option>
                                        <option value="9/16">Ratio 9:16 (TikTok)</option>
                                        <option value="1/1">Ratio 1:1</option>
                                    </select>
                                    <button className="text-slate-400 hover:text-white"><Maximize2 size={16} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Inspector */}
                <aside className="w-80 border-l border-white/5 bg-[#141414] flex flex-col overflow-hidden">
                    <div className="flex border-b border-white/5 h-10">
                        {['video', 'audio', 'speed', 'animation'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveInspectorTab(tab)}
                                className={`flex-1 text-[10px] font-bold uppercase tracking-wider transition relative ${activeInspectorTab === tab ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {tab}
                                {activeInspectorTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500"></div>}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {activeInspectorTab === 'video' && (
                            <>
                                <section>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Monitor size={12} /> Transform
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] text-slate-400">
                                                <span>Scale</span>
                                                <span className="text-indigo-400 tracking-tighter">{Math.round(getSelectedTransform().scale * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.1" max="3" step="0.01"
                                                className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-500"
                                                value={getSelectedTransform().scale}
                                                onChange={(e) => updateTransform('scale', parseFloat(e.target.value))}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <span className="text-[10px] text-slate-400">Position X</span>
                                                <input
                                                    type="number"
                                                    value={getSelectedTransform().x}
                                                    onChange={(e) => updateTransform('x', parseInt(e.target.value))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-md py-1 px-2 text-[10px]"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-[10px] text-slate-400">Position Y</span>
                                                <input
                                                    type="number"
                                                    value={getSelectedTransform().y}
                                                    onChange={(e) => updateTransform('y', parseInt(e.target.value))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-md py-1 px-2 text-[10px]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Ghost size={12} /> Blend
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <span className="text-[10px] text-slate-400">Opacity</span>
                                            <input
                                                type="range"
                                                min="0" max="100"
                                                className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-500"
                                                value={getSelectedTransform().opacity}
                                                onChange={(e) => updateTransform('opacity', parseInt(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Layout size={12} /> Mask
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['None', 'Horizontal', 'Mirror', 'Circle', 'Rectangle', 'Heart', 'Star'].map(mask => (
                                            <div key={mask} className={`aspect-square rounded border ${mask === 'Rectangle' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5'} flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/10 transition`}>
                                                <Ghost size={14} className={mask === 'Rectangle' ? 'text-indigo-400' : 'text-slate-600'} />
                                                <span className="text-[8px] text-slate-500">{mask}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        )}

                        {activeInspectorTab === 'speed' && (
                            <section>
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <SkipForward size={12} /> Speed Settings
                                </h4>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] text-slate-400">
                                            <span>Speed Multiplier</span>
                                            <span className="text-indigo-400 tracking-tighter">1.0x</span>
                                        </div>
                                        <input type="range" min="0.1" max="5.0" step="0.1" className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-500" defaultValue={1.0} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="pitch-correction" className="rounded bg-white/5 border-white/10" defaultChecked />
                                        <label htmlFor="pitch-correction" className="text-[10px] text-slate-400">Keep Audio Pitch</label>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>

                    <div className="p-4 border-t border-white/5 bg-[#1a1a1a]">
                        <button className="w-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white py-2 rounded-lg text-xs transition border border-white/10"> Reset all </button>
                    </div>
                </aside>
            </div>

            {/* Bottom: Timeline Wrapper */}
            <div className="h-[40%] min-h-[300px] border-t border-white/10 bg-[#0f0f0f] flex flex-col relative">
                {/* Timeline Header / Toolbar */}
                <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-[#141414] z-20">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition disabled:opacity-30"><Undo2 size={14} /></button>
                            <button onClick={handleRedo} disabled={historyIndex >= historyLength - 1} className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition disabled:opacity-30"><Redo2 size={14} /></button>
                        </div>
                        <div className="w-px h-4 bg-white/10"></div>
                        <div className="flex gap-1">
                            <button onClick={handleSplitClip} disabled={!timeline.selectedClipId} className="px-3 py-1.5 hover:bg-white/10 rounded-md text-slate-300 flex items-center gap-2 text-[10px] font-bold disabled:opacity-30 border border-white/5"><Scissors size={14} /> Split</button>
                            <button onClick={handleDeleteClip} disabled={!timeline.selectedClipId} className="px-3 py-1.5 hover:bg-white/10 rounded-md text-slate-300 flex items-center gap-2 text-[10px] font-bold disabled:opacity-30 border border-white/5"><Trash2 size={14} /> Delete</button>
                            <button className="px-3 py-1.5 hover:bg-white/10 rounded-md text-slate-300 flex items-center gap-2 text-[10px] font-bold border border-white/5"><Ghost size={14} /> Freeze</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <ZoomOut size={12} className="text-slate-500" />
                            <input type="range" min="5" max="100" step="5" value={timeline.zoom} onChange={handleZoom} className="w-32 h-1 bg-white/10 rounded-full appearance-none accent-indigo-500" />
                            <ZoomIn size={12} className="text-slate-500" />
                        </div>
                    </div>
                </div>

                {/* Actual Scrollable Timeline */}
                <div
                    ref={timelineRef}
                    className="flex-1 overflow-x-auto overflow-y-auto relative no-scrollbar"
                    onClick={handleTimelineClick}
                >
                    {/* Time Ruler */}
                    <div className="h-6 border-b border-white/5 sticky top-0 bg-[#0f0f0f] z-10 flex">
                        <div className="relative h-full" style={{ width: (Math.max(10, ...timeline.clips.map(c => c.startTime + c.duration)) + 20) * timeline.zoom }}>
                            {[...Array(Math.ceil((Math.max(10, ...timeline.clips.map(c => c.startTime + c.duration)) + 20) / 1))].map((_, i) => (
                                <div
                                    key={i}
                                    className={`absolute bottom-0 border-l border-white/10 ${i % 5 === 0 ? 'h-full' : 'h-1/2'}`}
                                    style={{ left: i * timeline.zoom }}
                                >
                                    {i % 5 === 0 && <span className="absolute left-1 bottom-0.5 text-[8px] text-slate-600 font-mono">{formatTime(i)}</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 pt-2 space-y-1 relative" style={{ width: (Math.max(10, ...timeline.clips.map(c => c.startTime + c.duration)) + 20) * timeline.zoom }}>
                        {timeline.tracks.map(track => (
                            <div
                                key={track.id}
                                className="h-16 relative group flex items-center"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleTimelineDrop(e, track.id)}
                            >
                                {/* Track Control Label */}
                                <div className="sticky left-0 w-24 h-full bg-[#111] border border-white/10 rounded-l-lg p-2 flex flex-col justify-center gap-1 z-20 shadow-2xl">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase truncate">{track.name}</span>
                                    <div className="flex gap-2">
                                        <Ghost className="opacity-20" size={10} />
                                        <Ghost className="opacity-20" size={10} />
                                    </div>
                                </div>

                                <div className="flex-1 h-full bg-white/5 rounded-r-lg border border-white/5 border-l-0 relative overflow-hidden">
                                    {timeline.clips.filter(c => c.trackId === track.id).map(clip => (
                                        <div
                                            key={clip.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateTimeline({ ...timeline, selectedClipId: clip.id });
                                            }}
                                            className={`absolute h-[90%] top-[5%] rounded border flex flex-col group overflow-hidden transition-all duration-200 ${timeline.selectedClipId === clip.id ? 'border-indigo-400 z-20 shadow-[0_0_15px_rgba(129,140,248,0.3)]' : 'border-white/10 hover:border-white/30'
                                                } ${clip.color || 'bg-indigo-900/40'}`}
                                            style={{
                                                left: clip.startTime * timeline.zoom,
                                                width: clip.duration * timeline.zoom,
                                                borderStyle: timeline.selectedClipId === clip.id ? 'solid' : 'dashed'
                                            }}
                                        >
                                            <div className="flex-1 flex overflow-hidden opacity-50 select-none pointer-events-none">
                                                {/* Visual Waveform or Thumbnails mockup */}
                                                {[...Array(Math.ceil(clip.duration))].map((_, i) => (
                                                    <div key={i} className="flex-shrink-0 w-8 h-full border-r border-white/5 bg-slate-800/20 flex items-center justify-center">
                                                        {clip.type === 'video' ? <Ghost size={16} className="text-slate-700" /> : <Ghost size={10} className="text-slate-700" />}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1 py-1 text-[8px] font-bold tracking-tighter truncate text-white pointer-events-none flex justify-between">
                                                <span>{clip.name}</span>
                                                <span className="text-white/50">{clip.duration.toFixed(1)}s</span>
                                            </div>

                                            {/* Selection Handles */}
                                            {timeline.selectedClipId === clip.id && (
                                                <>
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400 cursor-ew-resize"></div>
                                                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-400 cursor-ew-resize"></div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Timeline Playhead */}
                    <div
                        className="absolute top-0 bottom-0 w-px bg-white z-30 pointer-events-none transition-transform duration-100 ease-linear"
                        style={{
                            left: 0,
                            transform: `translateX(${(timeline.playhead * timeline.zoom) + 96 + 16}px)`, // 96 (sticky label) + 16 (padding)
                        }}
                    >
                        <div className="absolute -top-0 -left-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white"></div>
                        <div className="absolute top-0 left-0 w-px h-full bg-white shadow-[0_0_10px_rgba(255,255,255,1)]"></div>
                    </div>
                </div>

                {/* Timeline Status Bar */}
                <div className="h-6 bg-[#111] border-t border-white/5 flex items-center px-4 justify-between">
                    <div className="flex items-center gap-4 text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Monitor size={10} /> Track-based Editor v2.0</span>
                        <span className="flex items-center gap-1"><Ghost size={10} /> {timeline.clips.length} Clips Loaded</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Generic Search icon
const SearchIcon = ({ className, size }: { className?: string, size?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size || 16} height={size || 16}
        viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={className}
    >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);
