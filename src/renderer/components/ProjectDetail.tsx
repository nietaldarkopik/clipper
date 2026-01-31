import React, { useState, useEffect, useRef } from 'react';
import { 
    ChevronLeft, 
    Upload, 
    Download, 
    MoreVertical, 
    FileText, 
    Film, 
    Mic, 
    Sparkles, 
    Play, 
    Clock, 
    CheckCircle2, 
    Loader2,
    Trash2,
    RefreshCw,
    Scissors,
    Layers,
    Volume2,
    FolderOpen,
    X,
    Tags,
    Copy
} from 'lucide-react';
import { 
    downloadVideo, 
    uploadVideo, 
    analyzeVideo, 
    getTranscripts, 
    generateSummary, 
    generateScript,
    deleteVideo,
    generateHighlights,
    generateSpeech,
    mergeClips,
    clipVideo,
    saveClips,
    getJobStatus,
    deleteClip,
    getLibraryVideos,
    addVideoToProject,
    generateAIMetadata
} from '../api';

interface Project {
    id: string;
    name: string;
    description: string;
    videos?: any[];
    clips?: any[];
}

interface ProjectDetailProps {
    project: Project;
    onBack: () => void;
}

const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const ProjectDetail = ({ project: initialProject, onBack }: ProjectDetailProps) => {
    const [project, setProject] = useState(initialProject);
    const [videos, setVideos] = useState<any[]>([]);
    const [clips, setClips] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'videos' | 'highlights' | 'script'>('videos');
    const [processingVideos, setProcessingVideos] = useState<Set<string>>(new Set());
    const [processingClips, setProcessingClips] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Recap State
    const [summaries, setSummaries] = useState<Record<string, string>>({});
    const [script, setScript] = useState<string>('');
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Highlights State
    const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
    const [mergeName, setMergeName] = useState('');
    const [isMerging, setIsMerging] = useState(false);

    // Job Tracking State
    const [activeJob, setActiveJob] = useState<{ id: string, videoId: string } | null>(null);
    const [jobProgress, setJobProgress] = useState<number>(0);
    const [partialTranscript, setPartialTranscript] = useState<string>('');
    
    // Library Modal State
    const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
    const [libraryVideos, setLibraryVideos] = useState<any[]>([]);

    // Metadata State
    const [metadataResult, setMetadataResult] = useState<{ videoId: string, data: any } | null>(null);

    // Poll Active Job
    useEffect(() => {
        if (!activeJob) return;

        const interval = setInterval(async () => {
            try {
                const status = await getJobStatus('analyze', activeJob.id);
                setJobProgress(status.progress || 0);
                if (status.data && status.data.partialTranscript) {
                    setPartialTranscript(status.data.partialTranscript);
                }

                if (status.state === 'completed' || status.state === 'failed') {
                    setActiveJob(null);
                    setProcessingVideos(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(activeJob.videoId);
                        return newSet;
                    });
                    if (status.state === 'completed') {
                         alert("Analysis complete!");
                         refreshData();
                    } else {
                        alert("Analysis failed.");
                    }
                }
            } catch (e) {
                console.error("Error polling job:", e);
            }
        }, 1000); // Poll every second

        return () => clearInterval(interval);
    }, [activeJob]);

    const refreshData = () => {
        fetch(`http://localhost:3000/projects/${project.id}`)
            .then(res => res.json())
            .then(async (data) => {
                setProject(data);
                setVideos(data.videos || []);
                setClips(data.clips || []);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    };

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 3000); // Poll for updates
        return () => clearInterval(interval);
    }, [project.id]);

    const handleImportUrl = async () => {
        const url = prompt("Enter Video URL (YouTube, TikTok, etc):");
        if (!url) return;

        const downloadSubtitles = confirm("Do you want to try downloading subtitles?\n(Note: This might cause errors if YouTube blocks it due to rate limits)");

        try {
            await downloadVideo(url, project.id, downloadSubtitles);
            refreshData();
        } catch (error) {
            console.error("Import failed:", error);
            alert("Failed to import video");
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const filePath = (file as any).path || file.name; 

        try {
            await uploadVideo(filePath, 'local', {}, project.id);
            refreshData();
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Failed to upload video");
        }
    };

    const handleOpenLibrary = async () => {
        try {
            const data = await getLibraryVideos();
            console.log("Library videos:", data);
            if (data && data.videos) {
                // Filter out videos already in project
                const currentVideoIds = new Set(videos.map(v => v.id));
                const available = data.videos.filter((v: any) => !currentVideoIds.has(v.id));
                setLibraryVideos(available);
                setIsLibraryModalOpen(true);
            }
        } catch (error: any) {
            console.error("Failed to fetch library videos:", error);
            alert(`Failed to load library videos: ${error.message || error}`);
        }
    };

    const handleGenerateMetadata = async (videoId: string) => {
        setProcessingVideos(prev => new Set(prev).add(videoId));
        try {
            // Prefer summary, then transcript
            let context = summaries[videoId];
            if (!context) {
                const transcripts = await getTranscripts(videoId);
                if (transcripts && transcripts.length > 0) {
                    context = transcripts[0].content.text;
                }
            }

            if (!context) {
                alert("No summary or transcript available. Please analyze or generate summary first.");
                return;
            }

            const data = await generateAIMetadata(context);
            setMetadataResult({ videoId, data });
        } catch (error) {
            console.error(error);
            alert("Failed to generate metadata");
        } finally {
            setProcessingVideos(prev => {
                const newSet = new Set(prev);
                newSet.delete(videoId);
                return newSet;
            });
        }
    };

    const handleAddToProject = async (videoId: string) => {
        try {
            await addVideoToProject(project.id, videoId);
            setIsLibraryModalOpen(false);
            refreshData();
        } catch (error) {
            console.error("Failed to add video:", error);
            alert("Failed to add video to project");
        }
    };

    const handleAnalyze = async (videoId: string) => {
        const choice = prompt(
            "Select Transcription Method:\n\n" +
            "1. Download from YouTube (Subtitles)\n" +
            "2. Local Whisper (Tiny - Fastest)\n" +
            "3. Local Whisper (Base - Balanced)\n" +
            "4. Local Whisper (Small - Better)\n" +
            "5. Local Whisper (Medium - Best/Slow)\n",
            "2"
        );

        if (!choice) return;

        let method: 'youtube' | 'whisper' = 'whisper';
        let modelSize = 'tiny';

        switch (choice.trim()) {
            case '1':
                method = 'youtube';
                break;
            case '2':
                modelSize = 'tiny';
                break;
            case '3':
                modelSize = 'base';
                break;
            case '4':
                modelSize = 'small';
                break;
            case '5':
                modelSize = 'medium';
                break;
            default:
                // If user types model name directly or something else, default to tiny
                if (['tiny', 'base', 'small', 'medium'].includes(choice.toLowerCase())) {
                    modelSize = choice.toLowerCase();
                } else {
                    // Default fallback
                    modelSize = 'tiny';
                }
        }

        setProcessingVideos(prev => new Set(prev).add(videoId));
        try {
            const res = await analyzeVideo(videoId, modelSize, method);
            if (res.jobId) {
                setActiveJob({ id: res.jobId, videoId });
            }
        } catch (error) {
            console.error(error);
            alert("Analysis failed");
            setProcessingVideos(prev => {
                const newSet = new Set(prev);
                newSet.delete(videoId);
                return newSet;
            });
        }
    };

    const handleGenerateSummary = async (videoId: string) => {
        setProcessingVideos(prev => new Set(prev).add(videoId));
        try {
            const transcripts = await getTranscripts(videoId);
            if (!transcripts || transcripts.length === 0) {
                alert("No transcript available. Please analyze the video first.");
                return;
            }
            const transcriptText = transcripts[0].content.text;
            const summary = await generateSummary(transcriptText);
            setSummaries(prev => ({ ...prev, [videoId]: summary.summary }));
        } catch (error) {
            console.error(error);
            alert("Failed to generate summary");
        } finally {
            setProcessingVideos(prev => {
                const newSet = new Set(prev);
                newSet.delete(videoId);
                return newSet;
            });
        }
    };

    const handleGenerateHighlights = async (videoId: string) => {
        setProcessingVideos(prev => new Set(prev).add(videoId));
        try {
            const transcripts = await getTranscripts(videoId);
            if (!transcripts || transcripts.length === 0) {
                alert("No transcript available. Please analyze the video first.");
                return;
            }
            const transcriptText = transcripts[0].content.text;
            const result = await generateHighlights(transcriptText);
            
            if (result.highlights && result.highlights.length > 0) {
                await saveClips(result.highlights, videoId);
                alert(`Generated ${result.highlights.length} highlights! Check the Highlights tab.`);
                refreshData();
            } else {
                alert("No highlights found.");
            }
        } catch (error) {
            console.error(error);
            alert("Failed to generate highlights");
        } finally {
            setProcessingVideos(prev => {
                const newSet = new Set(prev);
                newSet.delete(videoId);
                return newSet;
            });
        }
    };

    const handleGenerateScript = async () => {
        setIsGeneratingScript(true);
        try {
            const allSummaries = Object.values(summaries).join("\n\n");
            if (!allSummaries && videos.length > 0) {
                 // Try to auto-generate if missing? For now just alert.
                 // Or we could iterate videos and get their summaries if stored in DB (we don't store them in DB yet, just local state).
                 // Ideally backend stores summaries.
            }
            
            const res = await generateScript(allSummaries || "No specific video summaries. Generate a generic intro.", 'documentary style');
            setScript(res.script);
            setActiveTab('script');
        } catch (error) {
            console.error(error);
            alert("Failed to generate script");
        } finally {
            setIsGeneratingScript(false);
        }
    };

    const handleReadAloud = async () => {
        if (!script) return;
        if (isPlayingAudio) {
            audioRef.current?.pause();
            setIsPlayingAudio(false);
            return;
        }

        try {
            const buffer = await generateSpeech(script);
            const blob = new Blob([buffer], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.play();
            setIsPlayingAudio(true);
            audio.onended = () => setIsPlayingAudio(false);
        } catch (e) {
            console.error(e);
            alert("Failed to generate speech");
        }
    };

    const handleDeleteVideo = async (videoId: string) => {
        if (!confirm("Remove video from project?")) return;
        try {
             await deleteVideo(videoId); // This deletes globally, might want just unlink later
             refreshData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteClip = async (clipId: string) => {
        if (!confirm("Delete this clip?")) return;
        try {
            await deleteClip(clipId);
            refreshData();
        } catch (e) {
            console.error(e);
        }
    };

    // Highlights & Clips
    const handleProcessClip = async (clip: any) => {
        setProcessingClips(prev => new Set(prev).add(clip.id));
        try {
            // clipVideo expects duration
            const duration = clip.end_time - clip.start_time;
            await clipVideo(clip.video_id, clip.start_time, duration);
        } catch (e) {
            console.error(e);
            alert("Failed to process clip");
        } finally {
             setProcessingClips(prev => {
                const newSet = new Set(prev);
                newSet.delete(clip.id);
                return newSet;
            });
        }
    };

    const toggleClipSelection = (clipId: string) => {
        setSelectedClips(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clipId)) newSet.delete(clipId);
            else newSet.add(clipId);
            return newSet;
        });
    };

    const handleMerge = async () => {
        if (selectedClips.size < 2) {
            alert("Select at least 2 clips to merge");
            return;
        }
        
        setIsMerging(true);
        try {
            // Get filepaths for selected clips
            // Only clips with filepath (processed) can be merged
            const clipsToMerge = clips.filter(c => selectedClips.has(c.id) && c.filepath);
            const filePaths = clipsToMerge.map(c => c.filepath);
            
            if (filePaths.length < selectedClips.size) {
                alert("Some selected clips are not processed yet. Please process them first.");
                setIsMerging(false);
                return;
            }

            await mergeClips(filePaths, project.id, mergeName || 'merged_highlight');
            setMergeName('');
            setSelectedClips(new Set());
            alert("Merge started! Check 'Project Videos' for the result shortly.");
        } catch (e) {
            console.error(e);
            alert("Failed to merge clips");
        } finally {
            setIsMerging(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900">
            {/* Active Job Overlay/Panel */}
            {activeJob && (
                <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 p-4 rounded-lg shadow-xl w-96 z-50">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-white flex items-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Transcribing... ({jobProgress}%)
                        </h3>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${jobProgress}%` }}></div>
                    </div>
                    <div className="bg-black p-2 rounded h-32 overflow-y-auto text-xs font-mono text-green-400 whitespace-pre-wrap">
                        {partialTranscript || "Waiting for output..."}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="border-b border-slate-700 bg-slate-800/50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white">{project.name}</h2>
                        <p className="text-sm text-slate-400">{project.description}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="video/*" 
                        onChange={handleFileChange}
                    />
                    <button 
                        onClick={handleUploadClick}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition"
                    >
                        <Upload size={16} /> Upload Video
                    </button>
                    <button 
                        onClick={handleOpenLibrary}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition"
                    >
                        <FolderOpen size={16} /> From Library
                    </button>
                    <button 
                        onClick={handleImportUrl}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition"
                    >
                        <Download size={16} /> Import from URL
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Tabs */}
                <div className="flex gap-6 border-b border-slate-700 mb-6">
                    <button 
                        onClick={() => setActiveTab('videos')}
                        className={`pb-3 text-sm font-medium transition ${activeTab === 'videos' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Project Videos
                    </button>
                    <button 
                        onClick={() => setActiveTab('highlights')}
                        className={`pb-3 text-sm font-medium transition ${activeTab === 'highlights' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Highlights & Clips
                    </button>
                    <button 
                        onClick={() => setActiveTab('script')}
                        className={`pb-3 text-sm font-medium transition ${activeTab === 'script' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Generated Script
                    </button>
                </div>

                {activeTab === 'videos' && (
                    <div className="space-y-4">
                         {videos.length === 0 ? (
                             <div className="text-center py-20 text-slate-500">
                                 <Film size={48} className="mx-auto mb-4 opacity-20" />
                                 <p>No videos in this project yet.</p>
                                 <p className="text-xs">Import or upload videos to get started.</p>
                             </div>
                         ) : (
                             videos.map(video => (
                                 <div key={video.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex gap-4">
                                     <div className="w-40 h-24 bg-black rounded-lg flex items-center justify-center relative overflow-hidden group">
                                         {video.thumbnail ? (
                                             <img src={video.thumbnail} className="w-full h-full object-cover" />
                                         ) : (
                                             <Film size={24} className="text-slate-600" />
                                         )}
                                         <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                                             {formatTime(video.duration)}
                                         </span>
                                     </div>
                                     <div className="flex-1">
                                         <div className="flex justify-between items-start">
                                             <h3 className="font-bold text-slate-200 line-clamp-1">{video.title || video.url}</h3>
                                             <button onClick={() => handleDeleteVideo(video.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
                                         </div>
                                         <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                             <span className={`px-2 py-0.5 rounded-full border ${video.status === 'completed' ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10'}`}>
                                                 {video.status}
                                             </span>
                                             <span>{new Date(video.created_at).toLocaleDateString()}</span>
                                         </div>
                                         
                                         <div className="mt-3 flex gap-2">
                                             <button 
                                                onClick={() => handleAnalyze(video.id)}
                                                disabled={processingVideos.has(video.id)}
                                                className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                                             >
                                                 {processingVideos.has(video.id) ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                                 Analyze & Transcribe
                                             </button>
                                             <button 
                                                 onClick={() => handleGenerateSummary(video.id)}
                                                 disabled={processingVideos.has(video.id)}
                                                 className="px-3 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                                             >
                                                 {processingVideos.has(video.id) ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                                Generate Summary
                                            </button>
                                            <button 
                                                onClick={() => handleGenerateHighlights(video.id)}
                                                disabled={processingVideos.has(video.id)}
                                                className="px-3 py-1.5 bg-pink-600/20 text-pink-400 hover:bg-pink-600 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                                            >
                                                {processingVideos.has(video.id) ? <Loader2 size={12} className="animate-spin" /> : <Scissors size={12} />}
                                                Generate Highlights
                                            </button>
                                            <button 
                                                onClick={() => handleGenerateMetadata(video.id)}
                                                disabled={processingVideos.has(video.id)}
                                                className="px-3 py-1.5 bg-teal-600/20 text-teal-400 hover:bg-teal-600 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                                            >
                                                {processingVideos.has(video.id) ? <Loader2 size={12} className="animate-spin" /> : <Tags size={12} />}
                                                Metadata
                                            </button>
                                        </div>
                                         
                                         {summaries[video.id] && (
                                             <div className="mt-3 p-3 bg-slate-900/50 rounded-lg text-xs text-slate-300 border border-slate-700">
                                                 <p className="line-clamp-2">{summaries[video.id]}</p>
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             ))
                         )}
                    </div>
                )}

                {activeTab === 'highlights' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <div>
                                <h3 className="text-white font-bold">Merge Selected Clips</h3>
                                <p className="text-xs text-slate-400">Select processed clips to combine them into a single video.</p>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Merged Video Name" 
                                    value={mergeName}
                                    onChange={(e) => setMergeName(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                                <button 
                                    onClick={handleMerge}
                                    disabled={selectedClips.size < 2 || isMerging}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                                >
                                    {isMerging ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                                    Merge {selectedClips.size} Clips
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {clips.length === 0 ? (
                                <div className="col-span-2 text-center py-10 text-slate-500">
                                    <Scissors size={32} className="mx-auto mb-2 opacity-20" />
                                    <p>No highlights found.</p>
                                    <p className="text-xs">Analyze videos to auto-generate highlights.</p>
                                </div>
                            ) : (
                                clips.map(clip => (
                                    <div key={clip.id} className={`bg-slate-800/30 border rounded-xl p-4 transition ${selectedClips.has(clip.id) ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-slate-200 text-sm line-clamp-1">{clip.label || "Untitled Clip"}</h4>
                                            <div className="flex items-center gap-2">
                                                {clip.filepath && (
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedClips.has(clip.id)}
                                                        onChange={() => toggleClipSelection(clip.id)}
                                                        className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-700"
                                                    />
                                                )}
                                                <button onClick={() => handleDeleteClip(clip.id)} className="text-slate-500 hover:text-red-400">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-3">
                                            {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
                                        </p>
                                        
                                        {!clip.filepath ? (
                                            <button 
                                                onClick={() => handleProcessClip(clip)}
                                                disabled={processingClips.has(clip.id)}
                                                className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-2"
                                            >
                                                {processingClips.has(clip.id) ? <Loader2 size={12} className="animate-spin" /> : <Scissors size={12} />}
                                                Process Clip
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 text-green-400 text-xs">
                                                <CheckCircle2 size={12} />
                                                <span>Ready to merge</span>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'script' && (
                    <div className="max-w-3xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Narrative Script</h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleReadAloud}
                                    disabled={!script}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${isPlayingAudio ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                                >
                                    {isPlayingAudio ? <Volume2 size={16} className="animate-pulse" /> : <Volume2 size={16} />}
                                    {isPlayingAudio ? 'Stop Reading' : 'Read Aloud'}
                                </button>
                                <button 
                                    onClick={handleGenerateScript}
                                    disabled={isGeneratingScript}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isGeneratingScript ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    Generate Script
                                </button>
                            </div>
                        </div>

                        {script ? (
                            <div className="bg-white/5 border border-white/10 p-8 rounded-xl min-h-[500px]">
                                <textarea 
                                    className="w-full h-full bg-transparent text-slate-200 text-sm leading-relaxed focus:outline-none resize-none"
                                    value={script}
                                    onChange={(e) => setScript(e.target.value)}
                                    rows={20}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-20 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
                                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No script generated yet.</p>
                                <p className="text-xs mt-2">Generate summaries for your videos, then click "Generate Script".</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Library Modal */}
            {isLibraryModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <FolderOpen className="w-5 h-5 text-emerald-400" />
                                Add Video from Library
                            </h2>
                            <button 
                                onClick={() => setIsLibraryModalOpen(false)}
                                className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded-lg"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            {libraryVideos.length === 0 ? (
                                <div className="text-center text-slate-500 py-12 flex flex-col items-center">
                                    <Film className="w-12 h-12 mb-3 opacity-20" />
                                    <p>No available videos found in library.</p>
                                    <p className="text-sm mt-2 opacity-60">Videos already in this project are hidden.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {libraryVideos.map((video) => (
                                        <div key={video.id} className="bg-slate-800/50 hover:bg-slate-800 p-3 rounded-lg flex gap-4 transition-colors border border-slate-700/50 hover:border-slate-600 group">
                                            <div className="w-24 h-16 bg-black/50 rounded overflow-hidden flex-shrink-0 relative border border-slate-700">
                                                <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                                                    <Film className="w-6 h-6" />
                                                </div>
                                                {/* If we had thumbnails, we'd show them here */}
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <h3 className="font-medium text-slate-200 truncate group-hover:text-white transition-colors" title={video.title}>
                                                    {video.title || "Untitled Video"}
                                                </h3>
                                                <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatTime(video.duration)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <FileText className="w-3 h-3" />
                                                        {video.source || 'Unknown Source'}
                                                    </span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleAddToProject(video.id)}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg self-center text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-800/30 text-xs text-slate-500 text-center">
                            Select a video to add it to the current project. This will move the video to this project.
                        </div>
                    </div>
                </div>
            )}
            {/* Metadata Modal */}
            {metadataResult && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Tags className="w-5 h-5 text-teal-400" />
                                Generated Metadata
                            </h2>
                            <button 
                                onClick={() => setMetadataResult(null)}
                                className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-700 rounded-lg"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Title Options</label>
                                <div className="space-y-2">
                                    {metadataResult.data.titles.map((title: string, i: number) => (
                                        <div key={i} className="flex gap-2">
                                            <input type="text" readOnly value={title} className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200" />
                                            <button onClick={() => navigator.clipboard.writeText(title)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-400 hover:text-white">
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                                <div className="relative">
                                    <textarea readOnly value={metadataResult.data.description} rows={6} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200" />
                                    <button onClick={() => navigator.clipboard.writeText(metadataResult.data.description)} className="absolute top-2 right-2 p-2 bg-slate-700/80 hover:bg-slate-600 rounded text-slate-400 hover:text-white">
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tags</label>
                                <div className="flex flex-wrap gap-2 bg-slate-800 border border-slate-700 rounded p-3">
                                    {metadataResult.data.tags.map((tag: string, i: number) => (
                                        <span key={i} className="bg-indigo-600/20 text-indigo-400 px-2 py-1 rounded text-xs border border-indigo-600/30">
                                            #{tag}
                                        </span>
                                    ))}
                                    <button onClick={() => navigator.clipboard.writeText(metadataResult.data.tags.join(', '))} className="ml-auto text-xs text-slate-500 hover:text-white flex items-center gap-1">
                                        <Copy size={12} /> Copy All
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
