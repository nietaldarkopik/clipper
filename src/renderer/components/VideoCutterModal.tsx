import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Scissors, Check, Plus, Trash2, List } from 'lucide-react';
import { BASE_URL } from '../api';

interface VideoCutterModalProps {
    video: any;
    onClose: () => void;
    onSave: (clips: Array<{ start_time: number; end_time: number; title: string }>) => void;
}

const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00.0';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
};

export const VideoCutterModal = ({ video, onClose, onSave }: VideoCutterModalProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [videoSrc, setVideoSrc] = useState('');
    const [retryAttempted, setRetryAttempted] = useState(false);
    
    // Current segment being edited
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [clipTitle, setClipTitle] = useState('');

    // List of added segments
    const [segments, setSegments] = useState<Array<{ start_time: number; end_time: number; title: string; id: string }>>([]);

    // Helper to get video source URL
    const getVideoSrc = (video: any) => {
        if (!video) return '';
        if (video.filepath && (video.filepath.includes('/') || video.filepath.includes('\\'))) {
            const filename = video.filepath.split(/[\\/]/).pop();
            const dir = video.filepath.includes('processed') ? 'processed' : 'downloads';
            return `${BASE_URL}/${dir}/${filename}`;
        }
        return video.url;
    };

    useEffect(() => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration || 0);
        }
    }, [videoRef.current]);

    useEffect(() => {
        if (video) {
            setVideoSrc(getVideoSrc(video));
            setRetryAttempted(false);
        }
    }, [video?.id, video?.filepath]);

    const handleVideoError = () => {
        console.log("Video load error, retrying...", videoSrc);
        if (retryAttempted) return;
        
        if (videoSrc.includes('/processed/')) {
            setVideoSrc(videoSrc.replace('/processed/', '/downloads/'));
            setRetryAttempted(true);
        } else if (videoSrc.includes('/downloads/')) {
            setVideoSrc(videoSrc.replace('/downloads/', '/processed/'));
            setRetryAttempted(true);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            if (!duration) setDuration(videoRef.current.duration);
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleSetStart = () => {
        setStartTime(currentTime);
        if (endTime < currentTime && endTime !== 0) {
             // If end is before new start, just keep end (user might adjust it next) 
             // or reset it? Let's reset if it's invalid.
             setEndTime(0);
        }
    };

    const handleSetEnd = () => {
        if (currentTime > startTime) {
            setEndTime(currentTime);
        } else {
            alert("End time must be after start time");
        }
    };

    const handleAddSegment = () => {
        if (endTime <= startTime || endTime === 0) {
            alert("Invalid clip duration. Please set both start and end points.");
            return;
        }

        const newSegment = {
            id: Math.random().toString(36).substr(2, 9),
            start_time: startTime,
            end_time: endTime,
            title: clipTitle || `Clip ${segments.length + 1} (${formatTime(startTime)})`
        };

        setSegments([...segments, newSegment]);
        
        // Reset for next segment
        setStartTime(endTime); // Convenience: start next clip where last one ended
        setEndTime(0);
        setClipTitle('');
    };

    const handleRemoveSegment = (id: string) => {
        setSegments(segments.filter(s => s.id !== id));
    };

    const handleSaveAll = () => {
        if (segments.length === 0) {
            // If no segments added but current selection is valid, add it and save
            if (endTime > startTime) {
                const singleClip = {
                    start_time: startTime,
                    end_time: endTime,
                    title: clipTitle || `Clip ${formatTime(startTime)}`
                };
                onSave([singleClip]);
                return;
            }
            alert("Please add at least one clip segment.");
            return;
        }
        onSave(segments.map(({ id, ...rest }) => rest));
    };



    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-6xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Scissors className="w-5 h-5 text-indigo-400" />
                        Multi-Cut Video Editor
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* Left: Player & Controls */}
                    <div className="flex-1 p-6 overflow-y-auto flex flex-col">
                        {/* Video Player */}
                        <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 relative group shadow-lg border border-slate-800 shrink-0">
                            <video 
                                ref={videoRef}
                                src={videoSrc}
                                className="w-full h-full object-contain"
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                                onClick={togglePlay}
                                onError={handleVideoError}
                            />
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white font-mono text-sm opacity-0 group-hover:opacity-100 transition">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </div>
                        </div>

                        {/* Timeline Controls */}
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                            {/* Progress Bar with Markers */}
                            <div className="relative h-4 bg-slate-700 rounded-full mb-8 cursor-pointer" onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const percentage = x / rect.width;
                                if (videoRef.current) {
                                    videoRef.current.currentTime = percentage * duration;
                                }
                            }}>
                                <div 
                                    className="absolute top-0 left-0 h-full bg-slate-600 rounded-full opacity-30" 
                                    style={{ width: `${(currentTime / duration) * 100}%` }}
                                />
                                
                                {/* Saved Segments */}
                                {segments.map(seg => (
                                    <div 
                                        key={seg.id}
                                        className="absolute top-0 h-full bg-green-500/50 border-l border-r border-green-400"
                                        style={{ 
                                            left: `${(seg.start_time / duration) * 100}%`,
                                            width: `${((seg.end_time - seg.start_time) / duration) * 100}%`
                                        }}
                                        title={seg.title}
                                    />
                                ))}

                                {/* Current Selection */}
                                {endTime > startTime && (
                                    <div 
                                        className="absolute top-0 h-full bg-indigo-500/50 border-l border-r border-indigo-400 z-10"
                                        style={{ 
                                            left: `${(startTime / duration) * 100}%`,
                                            width: `${((endTime - startTime) / duration) * 100}%`
                                        }}
                                    />
                                )}

                                {/* Playhead */}
                                <div 
                                    className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                                    style={{ left: `${(currentTime / duration) * 100}%` }}
                                />
                            </div>

                            {/* Control Buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-indigo-400 uppercase">Start Point</label>
                                    <div className="flex gap-2">
                                        <div className="bg-slate-900 border border-slate-700 px-3 py-2 rounded text-white font-mono w-24 text-center text-sm">
                                            {formatTime(startTime)}
                                        </div>
                                        <button 
                                            onClick={handleSetStart}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded px-3 py-2 text-sm font-bold transition"
                                        >
                                            Set Start
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-center gap-2">
                                    <button 
                                        onClick={togglePlay}
                                        className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition shadow-lg"
                                    >
                                        {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
                                    </button>
                                    <span className="text-xs text-slate-400 font-mono">
                                        Current Segment: {formatTime(Math.max(0, (endTime || currentTime) - startTime))}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-pink-400 uppercase">End Point</label>
                                    <div className="flex gap-2">
                                        <div className="bg-slate-900 border border-slate-700 px-3 py-2 rounded text-white font-mono w-24 text-center text-sm">
                                            {formatTime(endTime || currentTime)}
                                        </div>
                                        <button 
                                            onClick={handleSetEnd}
                                            className="flex-1 bg-pink-600 hover:bg-pink-500 text-white rounded px-3 py-2 text-sm font-bold transition"
                                        >
                                            Set End
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Add Segment Form */}
                        <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center gap-4">
                            <input 
                                type="text" 
                                placeholder="Segment Title (Optional)" 
                                value={clipTitle}
                                onChange={(e) => setClipTitle(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition w-full"
                            />
                            <button 
                                onClick={handleAddSegment}
                                disabled={endTime <= startTime}
                                className="w-full md:w-auto bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition"
                            >
                                <Plus size={18} />
                                Add Segment
                            </button>
                        </div>
                    </div>

                    {/* Right: Segments List */}
                    <div className="w-full lg:w-80 bg-slate-800/30 border-t lg:border-t-0 lg:border-l border-slate-700 flex flex-col">
                        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <List size={18} className="text-slate-400" />
                                Segments ({segments.length})
                            </h3>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {segments.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">
                                    <Scissors size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">No segments added yet.</p>
                                    <p className="text-xs mt-1">Set start/end points and click "Add Segment"</p>
                                </div>
                            ) : (
                                segments.map((seg, index) => (
                                    <div key={seg.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 hover:border-indigo-500/50 transition group">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-slate-200 text-sm line-clamp-1" title={seg.title}>
                                                {index + 1}. {seg.title}
                                            </span>
                                            <button 
                                                onClick={() => handleRemoveSegment(seg.id)}
                                                className="text-slate-500 hover:text-red-400 transition"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-400 font-mono">
                                            <span>{formatTime(seg.start_time)} - {formatTime(seg.end_time)}</span>
                                            <span className="text-indigo-400">{formatTime(seg.end_time - seg.start_time)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                            <button 
                                onClick={handleSaveAll}
                                disabled={segments.length === 0 && endTime <= startTime}
                                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-green-600/20"
                            >
                                <Check size={18} />
                                {segments.length > 0 ? `Save ${segments.length} Clips` : 'Save Current Clip'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
