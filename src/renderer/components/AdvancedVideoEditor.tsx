import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
    Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, 
    Layers, Type, Video, Music, Plus, Trash2, 
    Move, RotateCw, Crop, Monitor, Settings, Save,
    ChevronRight, ChevronDown, GripVertical, Scissors,
    Eye, EyeOff, Lock, Unlock, Download,
    Undo, Redo, AlignLeft, AlignCenter, AlignRight,
    Sticker, Wand2, Filter, Settings2, Sparkles, Ghost, Layout,
    Search, Clock, VolumeX, Volume2, MousePointer2, Image as ImageIcon, X, Loader2
} from 'lucide-react';
import { BASE_URL, renderProject } from '../api';

interface Clip {
    id: string;
    type: 'video' | 'audio' | 'text' | 'image';
    src?: string; // URL for video/image
    content?: string; // Text content
    start: number; // Start time on timeline (seconds)
    duration: number; // Duration in seconds
    offset: number; // Start time within the source media (trimming)
    layerId: string;
    // Transform properties
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity: number;
    width?: number; // Display width (for text/image or if resized)
    height?: number;
    // Crop properties (percentages 0-100)
    crop?: {
        enabled: boolean;
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    volume: number;
    // Audio Fade
    fadeIn?: number; // seconds
    fadeOut?: number; // seconds
    // Text properties
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    fontFamily?: string;
    // Speed
    speed?: number;
}

interface Layer {
    id: string;
    name: string;
    type: 'video' | 'audio' | 'text';
    visible: boolean;
    locked: boolean;
    muted?: boolean;
}

interface AdvancedVideoEditorProps {
    project: any;
    videos: any[];
    highlights?: any[];
    onClose: () => void;
    onAnalyze?: (videoId: string) => void;
    processingVideos?: Set<string>;
}

const FPS = 30;
const PIXELS_PER_SECOND = 50; // Base Timeline zoom level

export const AdvancedVideoEditor = ({ project, videos, highlights = [], onClose, onAnalyze, processingVideos }: AdvancedVideoEditorProps) => {
    // --- State ---
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(300); // Default 5 mins timeline
    const [aspectRatio, setAspectRatio] = useState<'16/9' | '9/16' | '1/1'>('16/9');
    
    // Layers & Clips
    const [layers, setLayers] = useState<Layer[]>([
        { id: 'l1', name: 'Main Video', type: 'video', visible: true, locked: false, muted: false },
        { id: 'l2', name: 'Overlay', type: 'video', visible: true, locked: false, muted: false },
        { id: 'l3', name: 'Text', type: 'text', visible: true, locked: false, muted: false },
        { id: 'l4', name: 'Audio', type: 'audio', visible: true, locked: false, muted: false },
    ]);
    
    const [clips, setClips] = useState<Clip[]>([]);
    const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null); // Keep for backward compat/primary selection

    // History (Undo/Redo)
    const [history, setHistory] = useState<{clips: Clip[], layers: Layer[]}[]>([]);
    const [future, setFuture] = useState<{clips: Clip[], layers: Layer[]}[]>([]);

    const recordHistory = useCallback(() => {
        setHistory(prev => [...prev.slice(-19), { clips, layers }]); // Keep last 20 actions
        setFuture([]);
    }, [clips, layers]);

    const undo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        
        setFuture(prev => [{ clips, layers }, ...prev]);
        setClips(previous.clips);
        setLayers(previous.layers);
        setHistory(newHistory);
    };

    const redo = () => {
        if (future.length === 0) return;
        const next = future[0];
        const newFuture = future.slice(1);

        setHistory(prev => [...prev, { clips, layers }]);
        setClips(next.clips);
        setLayers(next.layers);
        setFuture(newFuture);
    };

    // View Settings
    const [previewZoom, setPreviewZoom] = useState(1); // 1 = 100%
    const [timelineZoom, setTimelineZoom] = useState(1); // Scale factor for timeline
    const [activeSecondaryTab, setActiveSecondaryTab] = useState('media'); // media, audio, text, stickers, effects, filters, adjustments
    const [activeInspectorTab, setActiveInspectorTab] = useState('video'); // video, audio, speed, animation
    
    // Refs
    const mediaRefs = useRef<Record<string, HTMLMediaElement>>({});
    const timelineRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const timelineScrollRef = useRef<HTMLDivElement>(null);
    
    // Helper State for Dragging
    const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);

    // Render Modal State
    const [renderModalOpen, setRenderModalOpen] = useState(false);
    const [renderResolution, setRenderResolution] = useState('1080p');
    const [renderFormat, setRenderFormat] = useState('mp4');

    // --- Helpers ---
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const frames = Math.floor((seconds % 1) * FPS);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    };

    const getClipStyle = (clip: Clip) => {
        const left = clip.start * PIXELS_PER_SECOND * timelineZoom;
        const width = clip.duration * PIXELS_PER_SECOND * timelineZoom;
        return { left, width };
    };

    const selectedClip = useMemo(() => clips.find(c => c.id === selectedClipId), [clips, selectedClipId]);

    // --- Persistence ---
    useEffect(() => {
        const saved = localStorage.getItem(`editor_project_${project.id}`);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.layers) setLayers(data.layers);
                if (data.clips) setClips(data.clips);
                if (data.duration) setDuration(data.duration);
            } catch (e) {
                console.error("Failed to load saved project", e);
            }
        }
    }, [project.id]);

    // Resizable Panels State
    const [leftSidebarWidth, setLeftSidebarWidth] = useState(300);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(300);
    const [timelineHeight, setTimelineHeight] = useState(320);

    // Resizing Handlers
    const startResizeLeft = (e: React.MouseEvent) => {
        const startX = e.clientX;
        const startWidth = leftSidebarWidth;
        const doDrag = (ev: MouseEvent) => {
            setLeftSidebarWidth(Math.max(200, Math.min(600, startWidth + (ev.clientX - startX))));
        };
        const stopDrag = () => {
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
        };
        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
    };

    const startResizeRight = (e: React.MouseEvent) => {
        const startX = e.clientX;
        const startWidth = rightSidebarWidth;
        const doDrag = (ev: MouseEvent) => {
            setRightSidebarWidth(Math.max(200, Math.min(600, startWidth - (ev.clientX - startX))));
        };
        const stopDrag = () => {
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
        };
        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
    };

    const startResizeTimeline = (e: React.MouseEvent) => {
        const startY = e.clientY;
        const startHeight = timelineHeight;
        const doDrag = (ev: MouseEvent) => {
            setTimelineHeight(Math.max(150, Math.min(600, startHeight - (ev.clientY - startY))));
        };
        const stopDrag = () => {
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
        };
        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
    };

    // Auto-save
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    useEffect(() => {
        const timer = setInterval(() => {
            const projectData = {
                layers,
                clips,
                duration,
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem(`editor_project_${project.id}`, JSON.stringify(projectData));
            setLastSaved(new Date());
        }, 30000); // Auto-save every 30s
        return () => clearInterval(timer);
    }, [layers, clips, duration, project.id]);

    const handleSaveProject = () => {
        const projectData = {
            layers,
            clips,
            duration,
            lastSaved: new Date().toISOString()
        };
        localStorage.setItem(`editor_project_${project.id}`, JSON.stringify(projectData));
        setLastSaved(new Date());
        alert('Project saved locally!');
    };

    const handleRender = async () => {
        try {
            const projectData = {
                projectId: project.id,
                layers,
                clips,
                duration,
                resolution: renderResolution,
                format: renderFormat
            };
            
            const result = await renderProject(projectData);
            
            setRenderModalOpen(false);
            alert(`Render started! Job ID: ${result.jobId}\nYou can check progress in the Dashboard.`);
        } catch (error) {
            console.error('Failed to start render:', error);
            alert('Failed to start render process.');
        }
    };

    // --- Actions ---
    
    // Add Clip
    const handleAddClip = (layerId: string, type: Clip['type'], sourceVideo?: any, options?: Partial<Clip>) => {
        recordHistory();
        const newClip: Clip = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            src: sourceVideo ? (sourceVideo.filepath ? `${BASE_URL}/downloads/${sourceVideo.filepath.split(/[\\/]/).pop()}` : sourceVideo.url) : undefined,
            content: type === 'text' ? (options?.content || 'New Text') : undefined,
            start: currentTime,
            duration: sourceVideo ? (sourceVideo.duration || 10) : 5, // Default duration
            offset: 0,
            layerId,
            x: 0, y: 0, scale: 1, rotation: 0, opacity: 1,
            volume: 1,
            fadeIn: 0, fadeOut: 0,
            crop: { enabled: false, top: 0, bottom: 0, left: 0, right: 0 },
            fontSize: options?.fontSize || 48,
            color: '#ffffff',
            backgroundColor: 'transparent',
            textAlign: 'center',
            speed: 1,
            ...options
        };
        setClips(prev => [...prev, newClip]);
        setSelectedClipId(newClip.id);
        setSelectedClipIds(new Set([newClip.id]));
        return newClip;
    };

    // Update Clip
    const updateClip = (id: string, changes: Partial<Clip>, record = false) => {
        if (record) recordHistory();
        setClips(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
    };

    // Bulk Update Selected Clips
    const updateSelectedClips = (changes: Partial<Clip>) => {
        recordHistory();
        setClips(prev => prev.map(c => {
            if (selectedClipIds.has(c.id)) {
                return { ...c, ...changes };
            }
            return c;
        }));
    };

    // Split Clip
    const splitClip = () => {
        if (selectedClipIds.size === 0) return;
        
        const clipsToSplit = clips.filter(c => selectedClipIds.has(c.id));
        if (clipsToSplit.length === 0) return;

        recordHistory();
        
        let newClips = [...clips];
        let newSelection = new Set<string>();

        clipsToSplit.forEach(clip => {
             // Check if playhead is within the clip
            const relativeTime = currentTime - clip.start;
            if (relativeTime <= 0.1 || relativeTime >= clip.duration - 0.1) return;

            // Create new clip for the second half
            const splitPart: Clip = {
                ...clip,
                id: Math.random().toString(36).substr(2, 9),
                start: currentTime,
                duration: clip.duration - relativeTime,
                offset: clip.offset + relativeTime
            };

            // Update original clip
            const updatedOriginal = {
                ...clip,
                duration: relativeTime
            };

            newClips = newClips.map(c => c.id === clip.id ? updatedOriginal : c);
            newClips.push(splitPart);
            newSelection.add(splitPart.id);
        });
        
        setClips(newClips);
        if (newSelection.size > 0) {
            setSelectedClipIds(newSelection);
            setSelectedClipId(Array.from(newSelection)[0]);
        }
    };

    // Playback Loop
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying) {
            interval = setInterval(() => {
                setCurrentTime(prev => {
                    const next = prev + 0.05; // 50ms update for smoother UI, but sync handles frames
                    if (next >= duration) {
                        setIsPlaying(false);
                        return duration;
                    }
                    return next;
                });
            }, 50);
        }
        return () => clearInterval(interval);
    }, [isPlaying, duration]);

    // Sync Media Elements
    useEffect(() => {
        Object.entries(mediaRefs.current).forEach(([clipId, mediaEl]) => {
            const clip = clips.find(c => c.id === clipId);
            if (clip && mediaEl) {
                const clipTime = (currentTime - clip.start) * (clip.speed || 1) + clip.offset;
                
                // Volume & Fading Logic
                let effectiveVolume = clip.volume;
                const fadeIn = clip.fadeIn || 0;
                const fadeOut = clip.fadeOut || 0;
                const relativeClipTime = currentTime - clip.start; // Time since start of clip rendering on timeline

                if (relativeClipTime < fadeIn && fadeIn > 0) {
                    effectiveVolume = clip.volume * (relativeClipTime / fadeIn);
                } else if (relativeClipTime > (clip.duration - fadeOut) && fadeOut > 0) {
                    const timeUntilEnd = clip.duration - relativeClipTime;
                    effectiveVolume = clip.volume * (Math.max(0, timeUntilEnd) / fadeOut);
                }
                
                // Check if layer is visible (acts as mute)
                const layer = layers.find(l => l.id === clip.layerId);
                if (layer) {
                    if (layer.type === 'video' && !layer.visible) effectiveVolume = 0; // Hide video = mute audio usually? Or separating video/audio tracks? Assuming hide = mute for now
                    if (layer.muted) effectiveVolume = 0;
                }

                mediaEl.volume = Math.max(0, Math.min(1, effectiveVolume));
                mediaEl.playbackRate = clip.speed || 1;

                if (currentTime >= clip.start && currentTime <= clip.start + clip.duration) {
                     // Check if we need to sync manually (drift correction)
                    if (Math.abs(mediaEl.currentTime - clipTime) > 0.25) {
                         mediaEl.currentTime = clipTime;
                    }
                    
                    if (isPlaying && mediaEl.paused) {
                        mediaEl.play().catch(e => console.warn("Play failed", e));
                    }
                    if (!isPlaying && !mediaEl.paused) mediaEl.pause();
                } else {
                    mediaEl.pause();
                    // Reset if far off
                    if (Math.abs(mediaEl.currentTime - clip.offset) > 0.1) {
                        // mediaEl.currentTime = clip.offset; 
                    }
                }
            }
        });
    }, [currentTime, isPlaying, clips, layers]);


    // Frame Stepping
    const stepFrame = (frames: number) => {
        setIsPlaying(false);
        setCurrentTime(prev => Math.max(0, prev + (frames / FPS)));
    };

    // State Ref for event handlers
    const [copiedClip, setCopiedClip] = useState<Clip | null>(null);
    const stateRef = useRef({ clips, layers, currentTime, selectedClipId, copiedClip, history, future, recordHistory });
    useEffect(() => {
        stateRef.current = { clips, layers, currentTime, selectedClipId, copiedClip, history, future, recordHistory };
    }, [clips, layers, currentTime, selectedClipId, copiedClip, history, future, recordHistory]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const { clips, layers, currentTime, selectedClipId, copiedClip, history, future, recordHistory } = stateRef.current;

            if (e.ctrlKey || e.metaKey) {
                if (e.code === 'KeyZ') {
                    if (e.shiftKey) {
                        // Redo
                        if (future.length === 0) return;
                        const next = future[0];
                        const newFuture = future.slice(1);
                        setHistory(prev => [...prev, { clips, layers }]);
                        setClips(next.clips);
                        setLayers(next.layers);
                        setFuture(newFuture);
                    } else {
                        // Undo
                        if (history.length === 0) return;
                        const previous = history[history.length - 1];
                        const newHistory = history.slice(0, -1);
                        setFuture(prev => [{ clips, layers }, ...prev]);
                        setClips(previous.clips);
                        setLayers(previous.layers);
                        setHistory(newHistory);
                    }
                    return;
                } else if (e.code === 'KeyY') {
                    // Redo
                    if (future.length === 0) return;
                    const next = future[0];
                    const newFuture = future.slice(1);
                    setHistory(prev => [...prev, { clips, layers }]);
                    setClips(next.clips);
                    setLayers(next.layers);
                    setFuture(newFuture);
                    return;
                } else if (e.code === 'KeyC') {
                    if (selectedClipId) {
                        const clip = clips.find(c => c.id === selectedClipId);
                        if (clip) {
                            setCopiedClip(clip);
                        }
                    }
                } else if (e.code === 'KeyV') {
                    if (copiedClip) {
                        recordHistory();
                        const targetLayerId = layers.find(l => l.id === copiedClip.layerId) ? copiedClip.layerId : (layers[0]?.id || 'l1');
                        const newClip = {
                            ...copiedClip,
                            id: Math.random().toString(36).substr(2, 9),
                            start: currentTime, // Paste at playhead
                            layerId: targetLayerId
                        };
                        setClips(prev => [...prev, newClip]);
                        setSelectedClipId(newClip.id);
                        setSelectedClipIds(new Set([newClip.id]));
                    }
                }
                return;
            }

            if (e.code === 'Space') {
                e.preventDefault();
                setIsPlaying(prev => !prev);
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                stepFrame(-1);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                stepFrame(1);
            } else if (e.code === 'Delete' || e.code === 'Backspace') {
                if (selectedClipIds.size > 0) {
                    recordHistory();
                    setClips(prev => prev.filter(c => !selectedClipIds.has(c.id)));
                    setSelectedClipIds(new Set());
                    setSelectedClipId(null);
                }
            } else if (e.code === 'KeyS') { // Split
                e.preventDefault();
                splitClip();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []); // No deps, uses ref

    // Timeline Interactions
    const [dragging, setDragging] = useState<{ 
        id: string, 
        type: 'move' | 'resize-start' | 'resize-end' | 'scrub', 
        startX: number, 
        initialStart: number,
        initialDuration: number,
        initialOffset: number,
        initialStates?: Record<string, { start: number, duration: number, offset: number, layerId: string }>
    } | null>(null);

    const handleTimelineMouseMove = (e: React.MouseEvent) => {
        if (!dragging) return;
        
        const deltaPixels = e.clientX - dragging.startX;
        const deltaTime = deltaPixels / (PIXELS_PER_SECOND * timelineZoom);

        if (dragging.type === 'scrub') {
             // Scrubbing logic
             const rect = timelineScrollRef.current?.getBoundingClientRect();
             if (rect) {
                 const x = e.clientX - rect.left + (timelineScrollRef.current?.scrollLeft || 0) - 192; // 192 = track header width
                 const newTime = Math.max(0, x / (PIXELS_PER_SECOND * timelineZoom));
                 setCurrentTime(Math.min(newTime, duration));
             }
        } else if (dragging.type === 'move') {
            // Calculate delta for the PRIMARY dragged clip
            let newStart = Math.max(0, dragging.initialStart + deltaTime);
            
            // Snapping (based on primary clip)
            const SNAP_THRESHOLD = 10 / (PIXELS_PER_SECOND * timelineZoom);
            let closestSnap = null;
            let minDiff = Infinity;
            
            const snapPoints = [0, currentTime, duration];
            clips.forEach(c => {
                if (c.id !== dragging.id) { // Don't snap to self
                    snapPoints.push(c.start, c.start + c.duration);
                }
            });
            
            snapPoints.forEach(p => {
                const diff = Math.abs(p - newStart);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestSnap = p;
                }
            });
            
            if (closestSnap !== null && minDiff < SNAP_THRESHOLD) {
                newStart = closestSnap;
            }

            // Calculate effective delta to apply to ALL selected clips
            const effectiveDelta = newStart - dragging.initialStart;

            // Apply to all selected clips (if they exist in initialStates)
            if (dragging.initialStates && Object.keys(dragging.initialStates).length > 0) {
                 setClips(prev => prev.map(c => {
                     const state = dragging.initialStates?.[c.id];
                     if (state) {
                         const updatedStart = Math.max(0, state.start + effectiveDelta);
                         let changes: any = { start: updatedStart };
                         
                         if (c.id === dragging.id) {
                             if (hoveredLayerId && hoveredLayerId !== state.layerId) {
                                 changes.layerId = hoveredLayerId;
                             }
                         }
                         return { ...c, ...changes };
                     }
                     return c;
                 }));
            } else {
                // Fallback for single clip (should normally use initialStates now)
                const changes: any = { start: newStart };
                if (hoveredLayerId && hoveredLayerId !== clips.find(c => c.id === dragging.id)?.layerId) {
                    changes.layerId = hoveredLayerId;
                }
                updateClip(dragging.id, changes);
            }
        } else if (dragging.type === 'resize-end') {
            let newDuration = Math.max(0.1, dragging.initialDuration + deltaTime);
            let newEnd = dragging.initialStart + newDuration;

            // Snapping
            const SNAP_THRESHOLD = 10 / (PIXELS_PER_SECOND * timelineZoom);
            let closestSnap = null;
            let minDiff = Infinity;
            
            const snapPoints = [0, currentTime, duration];
            clips.forEach(c => {
                if (c.id !== dragging.id) {
                    snapPoints.push(c.start, c.start + c.duration);
                }
            });
            
            snapPoints.forEach(p => {
                const diff = Math.abs(p - newEnd);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestSnap = p;
                }
            });
            
            if (closestSnap !== null && minDiff < SNAP_THRESHOLD) {
                newDuration = closestSnap - dragging.initialStart;
            }

            updateClip(dragging.id, { duration: Math.max(0.1, newDuration) });
        } else if (dragging.type === 'resize-start') {
            let delta = deltaTime;
            let newStart = dragging.initialStart + delta;

            // Snapping
            const SNAP_THRESHOLD = 10 / (PIXELS_PER_SECOND * timelineZoom);
            let closestSnap = null;
            let minDiff = Infinity;
            
            const snapPoints = [0, currentTime, duration];
            clips.forEach(c => {
                if (c.id !== dragging.id) {
                    snapPoints.push(c.start, c.start + c.duration);
                }
            });
            
            snapPoints.forEach(p => {
                const diff = Math.abs(p - newStart);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestSnap = p;
                }
            });
            
            if (closestSnap !== null && minDiff < SNAP_THRESHOLD) {
                newStart = closestSnap;
                delta = newStart - dragging.initialStart;
            }

            const newDuration = dragging.initialDuration - delta;
            const newOffset = dragging.initialOffset + delta;
            
            if (newDuration >= 0.1 && newStart >= 0) {
                updateClip(dragging.id, { 
                    start: newStart, 
                    duration: newDuration, 
                    offset: newOffset 
                });
            }
        }
    };

    const handleTimelineMouseUp = () => {
        setDragging(null);
    };

    // Drag and Drop from Assets
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, layerId: string) => {
        e.preventDefault();
        const videoId = e.dataTransfer.getData('videoId');
        const type = e.dataTransfer.getData('type');
        const subtype = e.dataTransfer.getData('subtype');
        const jsonData = e.dataTransfer.getData('application/json');
        
        // Determine target layer type
        const targetLayer = layers.find(l => l.id === layerId);
        if (targetLayer?.locked) return;
        const layerType = targetLayer?.type || 'video';

        if (jsonData) {
            try {
                const data = JSON.parse(jsonData);
                if (data.type === 'video') {
                    // Handle Highlight/Clip Drop
                    handleAddClip(layerId, 'video', undefined, {
                        src: data.src,
                        duration: data.duration,
                        content: data.name // Used for label if needed
                    });
                }
            } catch (e) {
                console.error("Failed to parse drop data", e);
            }
        } else if (videoId) {
            const video = videos.find(v => v.id === videoId);
            if (video) {
                // If dropping on audio layer, create audio clip
                const clipType = layerType === 'audio' ? 'audio' : 'video';
                handleAddClip(layerId, clipType, video);
            }
        } else if (type === 'text') {
            const options: Partial<Clip> = {};
            if (subtype === 'title') {
                options.fontSize = 72;
                options.content = 'TITLE TEXT';
            } else if (subtype === 'subtitle') {
                options.fontSize = 32;
                options.content = 'Subtitle text';
            }
            handleAddClip(layerId, 'text', undefined, options);
        }
    };

    const secondaryNav = [
        { id: 'media', icon: <Video size={20} />, label: 'Media' },
        { id: 'audio', icon: <Music size={20} />, label: 'Audio' },
        { id: 'text', icon: <Type size={20} />, label: 'Text' },
        { id: 'stickers', icon: <Sticker size={20} />, label: 'Stickers' },
        { id: 'effects', icon: <Wand2 size={20} />, label: 'Effects' },
        { id: 'transitions', icon: <Layers size={20} />, label: 'Trans.' },
        { id: 'filters', icon: <Filter size={20} />, label: 'Filters' },
        { id: 'adjustment', icon: <Settings2 size={20} />, label: 'Adjust' },
    ];

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-white overflow-hidden select-none" onMouseMove={handleTimelineMouseMove} onMouseUp={handleTimelineMouseUp}>
            {/* Top Toolbar */}
            <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#181818]">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-lg mr-2 text-indigo-400">ProEditor</h2>
                    {lastSaved && (
                         <div className="text-[10px] text-slate-500 flex items-center gap-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                             Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </div>
                    )}
                    <div className="flex gap-1 bg-[#2a2a2a] p-1 rounded">
                        <button onClick={undo} disabled={history.length === 0} className="p-1.5 hover:bg-[#333] rounded text-slate-400 hover:text-white disabled:opacity-30">
                            <Undo size={16} />
                        </button>
                        <button onClick={redo} disabled={future.length === 0} className="p-1.5 hover:bg-[#333] rounded text-slate-400 hover:text-white disabled:opacity-30">
                            <Redo size={16} />
                        </button>
                    </div>
                    <div className="w-px bg-[#333] h-6"></div>
                    <div className="flex gap-1">
                        <button className="p-1.5 hover:bg-[#333] rounded text-slate-400 hover:text-white" onClick={splitClip} title="Split (S)">
                            <Scissors size={16} />
                        </button>
                        <button 
                            className="p-1.5 hover:bg-[#333] rounded text-slate-400 hover:text-white" 
                            onClick={() => selectedClipId && setCopiedClip(clips.find(c => c.id === selectedClipId) || null)}
                            title="Copy (Ctrl+C)"
                        >
                            <span className="font-bold text-xs">Copy</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                     <div className="bg-[#2a2a2a] rounded flex text-xs font-medium">
                        <button onClick={() => setAspectRatio('16/9')} className={`px-2 py-1 rounded-l ${aspectRatio === '16/9' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>16:9</button>
                        <button onClick={() => setAspectRatio('9/16')} className={`px-2 py-1 ${aspectRatio === '9/16' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>9:16</button>
                        <button onClick={() => setAspectRatio('1/1')} className={`px-2 py-1 rounded-r ${aspectRatio === '1/1' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>1:1</button>
                    </div>

                    <button 
                        onClick={() => {
                            const data = JSON.stringify({ layers, clips, duration });
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `project_${project.id}_export.json`;
                            a.click();
                        }}
                        className="bg-[#2a2a2a] hover:bg-[#333] px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition"
                    >
                        <Download size={14} /> Export JSON
                    </button>
                    <button 
                        onClick={() => setRenderModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition"
                    >
                        <Video size={14} /> Render Video
                    </button>
                    <button 
                        onClick={handleSaveProject}
                        className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition"
                    >
                        <Save size={14} /> Save
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-[#333] rounded">
                        <Monitor size={16} />
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* 1. Left Sidebar (Navigation + Panel) */}
                <div className="flex border-r border-[#333] bg-[#1e1e1e]" style={{ width: leftSidebarWidth }}>
                    {/* Icon Strip */}
                    <div className="w-16 bg-[#181818] flex flex-col items-center py-4 gap-6 border-r border-[#333] z-10">
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

                    {/* Panel Content */}
                    <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
                        <div className="p-3 border-b border-[#333]">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{activeSecondaryTab}</h3>
                            <div className="relative">
                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="text" placeholder="Search..." className="w-full bg-[#121212] border border-[#333] rounded py-1 pl-7 pr-2 text-xs focus:outline-none focus:border-indigo-500" />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {activeSecondaryTab === 'media' && (
                                <div className="space-y-4">
                                    {/* Highlights Section */}
                                    {highlights && highlights.length > 0 && (
                                        <section>
                                            <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <Sparkles size={10} /> Highlights
                                            </h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                {highlights.map(clip => (
                                                    <div 
                                                        key={clip.id} 
                                                        draggable 
                                                        onDragStart={(e) => {
                                                            const parts = (clip.duration || "0:05").split(':').map(Number);
                                                            const durationSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 5;
                                                            
                                                            e.dataTransfer.setData('application/json', JSON.stringify({
                                                                type: 'video',
                                                                src: clip.filepath ? `${BASE_URL}/processed/${clip.filepath.split(/[\\/]/).pop()}` : undefined,
                                                                duration: durationSec,
                                                                name: clip.label || clip.name
                                                            }));
                                                        }}
                                                        className="bg-orange-900/20 border border-orange-500/20 p-2 rounded cursor-grab hover:bg-orange-900/40 transition group relative"
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Video size={14} className="text-orange-400" />
                                                            <span className="text-[10px] font-medium truncate text-orange-200">{clip.label || clip.name || "Highlight"}</span>
                                                        </div>
                                                        <div className="text-[9px] text-orange-400/60 font-mono">{clip.duration}</div>
                                                        
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const parts = (clip.duration || "0:05").split(':').map(Number);
                                                                const durationSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 5;
                                                                handleAddClip(layers.find(l=>l.type==='video')?.id || 'l1', 'video', {
                                                                    filepath: clip.filepath,
                                                                    duration: durationSec
                                                                }, {
                                                                    content: clip.label // Just metadata
                                                                });
                                                            }}
                                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-orange-600 rounded text-white hover:bg-orange-500 transition"
                                                            title="Add to Timeline"
                                                        >
                                                            <Plus size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {/* Full Videos Section */}
                                    <section>
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Source Videos</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {videos.map(v => {
                                        const isProcessing = processingVideos?.has(v.id);
                                        return (
                                            <div 
                                                key={v.id} 
                                                draggable 
                                                onDragStart={(e) => e.dataTransfer.setData('videoId', v.id)}
                                                className="bg-[#2a2a2a] p-1 rounded cursor-grab hover:bg-[#333] transition group relative border border-transparent hover:border-indigo-500/50"
                                            >
                                                <div className="aspect-video bg-black mb-1 rounded overflow-hidden relative group">
                                                    {v.thumbnail ? (
                                                        <img src={v.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                                                    ) : (
                                                        <Video size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-600" />
                                                    )}
                                                    
                                                    {/* Duration Badge */}
                                                    <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] px-1 rounded z-10 pointer-events-none">
                                                        {formatTime(v.duration || 0)}
                                                    </div>

                                                    {/* Overlays */}
                                                    {isProcessing ? (
                                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-indigo-400 gap-1">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                                            <span className="text-[8px] font-bold">ANALYZING</span>
                                                        </div>
                                                    ) : (
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAddClip(layers.find(l=>l.type==='video')?.id || 'l1', 'video', v);
                                                                }}
                                                                title="Add to Timeline"
                                                                className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white shadow-lg transform hover:scale-110 transition"
                                                            >
                                                                <Plus size={12} />
                                                            </button>
                                                            {onAnalyze && (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onAnalyze(v.id);
                                                                    }}
                                                                    title="AI Analyze"
                                                                    className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded-full text-white shadow-lg transform hover:scale-110 transition"
                                                                >
                                                                    <Sparkles size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-[10px] font-medium truncate px-1 text-slate-300 group-hover:text-white">{v.title || "Untitled"}</div>
                                            </div>
                                        );
                                    })}
                                    </div>
                                    </section>
                                </div>
                            )}
                            
                            {activeSecondaryTab === 'text' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div 
                                        draggable 
                                        onDragStart={(e) => { e.dataTransfer.setData('type', 'text'); }}
                                        className="bg-[#2a2a2a] aspect-square rounded cursor-grab hover:bg-[#333] flex flex-col items-center justify-center border border-[#333]"
                                    >
                                        <Type size={24} className="mb-2 text-slate-400" /> 
                                        <span className="text-xs font-bold">Default</span>
                                    </div>
                                    <div 
                                        draggable 
                                        onDragStart={(e) => { e.dataTransfer.setData('type', 'text'); e.dataTransfer.setData('subtype', 'title'); }}
                                        className="bg-[#2a2a2a] aspect-square rounded cursor-grab hover:bg-[#333] flex flex-col items-center justify-center border border-[#333]"
                                    >
                                        <span className="text-xl font-bold mb-1">Title</span>
                                        <span className="text-[9px] text-slate-400">Large</span>
                                    </div>
                                    <div 
                                        draggable 
                                        onDragStart={(e) => { e.dataTransfer.setData('type', 'text'); e.dataTransfer.setData('subtype', 'subtitle'); }}
                                        className="bg-[#2a2a2a] aspect-square rounded cursor-grab hover:bg-[#333] flex flex-col items-center justify-center border border-[#333]"
                                    >
                                        <span className="text-sm font-bold mb-1">Subtitle</span>
                                        <span className="text-[9px] text-slate-400">Medium</span>
                                    </div>
                                </div>
                            )}

                            {activeSecondaryTab === 'audio' && (
                                <div className="text-center text-slate-500 text-sm mt-8">
                                    <Music size={32} className="mx-auto mb-2 opacity-50"/>
                                    <p className="mb-4 text-xs">No stock audio</p>
                                    <button 
                                        onClick={() => handleAddClip(layers.find(l=>l.type==='audio')?.id || 'l4', 'audio')} 
                                        className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] rounded text-[10px] font-bold border border-[#333] transition"
                                    >
                                        Add Empty Track
                                    </button>
                                </div>
                            )}

                            {!['media', 'text', 'audio'].includes(activeSecondaryTab) && (
                                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                    <Ghost size={24} className="mb-2 opacity-50"/>
                                    <span className="text-xs">Coming Soon</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Left Resize Handle */}
                <div 
                    className="w-1 bg-[#333] hover:bg-indigo-500 cursor-col-resize z-20 transition-colors"
                    onMouseDown={startResizeLeft}
                />

                {/* 2. Center (Preview + Timeline) */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f0f]">
                    {/* Preview Area */}
                    <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] to-[#0a0a0a]">
                         <div 
                            ref={previewContainerRef}
                            className="relative shadow-2xl transition-transform duration-200"
                            style={{ 
                                width: aspectRatio === '16/9' ? '640px' : (aspectRatio === '9/16' ? '360px' : '480px'),
                                height: aspectRatio === '16/9' ? '360px' : (aspectRatio === '9/16' ? '640px' : '480px'),
                                transform: `scale(${previewZoom})`,
                                backgroundColor: '#000'
                            }}
                        >
                            {/* Render Clips */}
                            {layers.filter(l => l.visible).map(layer => {
                                // Get clips for this layer at current time
                                const activeClips = clips.filter(c => 
                                    c.layerId === layer.id && 
                                    currentTime >= c.start && 
                                    currentTime < c.start + c.duration
                                );

                                return activeClips.map(clip => {
                                    const isActive = selectedClipId === clip.id;
                                    
                                    if (clip.type === 'video') {
                                        const cropStyle = clip.crop?.enabled ? {
                                            clipPath: `inset(${clip.crop.top}% ${clip.crop.right}% ${clip.crop.bottom}% ${clip.crop.left}%)`
                                        } : {};
                                        return (
                                            <div key={clip.id} className="absolute inset-0 overflow-hidden" 
                                                style={{ 
                                                    opacity: clip.opacity,
                                                    transform: `translate(${clip.x}px, ${clip.y}px) rotate(${clip.rotation}deg) scale(${clip.scale})`,
                                                    zIndex: layers.findIndex(l => l.id === layer.id),
                                                    ...cropStyle
                                                }}
                                            >
                                                <video 
                                                    ref={el => { if(el) mediaRefs.current[clip.id] = el; }}
                                                    src={clip.src}
                                                    className="w-full h-full object-contain pointer-events-none"
                                                    muted
                                                />
                                            </div>
                                        );
                                    } else if (clip.type === 'text') {
                                        return (
                                            <div key={clip.id} 
                                                className={`absolute inset-0 flex items-center justify-center pointer-events-none select-none`}
                                                style={{ 
                                                    opacity: clip.opacity,
                                                    transform: `translate(${clip.x}px, ${clip.y}px) rotate(${clip.rotation}deg) scale(${clip.scale})`,
                                                    zIndex: layers.findIndex(l => l.id === layer.id)
                                                }}
                                            >
                                                <div style={{ 
                                                    fontSize: `${clip.fontSize}px`, 
                                                    color: clip.color, 
                                                    backgroundColor: clip.backgroundColor,
                                                    textAlign: clip.textAlign,
                                                    padding: '4px 8px',
                                                    whiteSpace: 'pre-wrap',
                                                    fontFamily: clip.fontFamily || 'Inter'
                                                }}>
                                                    {clip.content}
                                                </div>
                                            </div>
                                        );
                                    } else if (clip.type === 'audio') {
                                         // Audio only, invisible element but we need ref
                                         return (
                                            <audio 
                                                key={clip.id}
                                                ref={el => { if(el) mediaRefs.current[clip.id] = el; }}
                                                src={clip.src}
                                                className="hidden"
                                            />
                                         );
                                    }
                                    return null;
                                });
                            })}
                        </div>

                        {/* Preview Controls Overlay */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur px-4 py-2 rounded-full border border-white/10">
                            <div className="flex items-center gap-1 mr-2 border-r border-white/10 pr-2">
                                <button onClick={() => setPreviewZoom(z => Math.max(0.1, z - 0.1))} className="hover:text-indigo-400 p-1">
                                    <ZoomOut size={14}/>
                                </button>
                                <span className="text-[10px] w-8 text-center">{Math.round(previewZoom * 100)}%</span>
                                <button onClick={() => setPreviewZoom(z => Math.min(3, z + 0.1))} className="hover:text-indigo-400 p-1">
                                    <ZoomIn size={14}/>
                                </button>
                            </div>
                            <button onClick={() => setCurrentTime(0)} className="hover:text-indigo-400"><SkipBack size={16}/></button>
                            <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-indigo-400">
                                {isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
                            </button>
                            <button onClick={() => setCurrentTime(duration)} className="hover:text-indigo-400"><SkipForward size={16}/></button>
                            <span className="font-mono text-xs w-20 text-center">{formatTime(currentTime)}</span>
                        </div>
                    </div>

                    {/* Timeline Resize Handle */}
                    <div 
                        className="h-1 bg-[#333] hover:bg-indigo-500 cursor-row-resize z-20 transition-colors"
                        onMouseDown={startResizeTimeline}
                    />
                    {/* Timeline Area */}
                    <div className="bg-[#121212] flex flex-col border-t border-[#333]" style={{ height: timelineHeight }}>
                        {/* Timeline Toolbar */}
                        <div className="h-10 bg-[#1e1e1e] border-b border-[#333] flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <button className="p-1.5 hover:bg-[#333] rounded" title="Add Video Track" onClick={() => setLayers([...layers, { id: `l${Date.now()}`, name: 'New Video', type: 'video', visible: true, locked: false, muted: false }])}>
                                    <Video size={14} className="text-slate-400" />
                                </button>
                                <button className="p-1.5 hover:bg-[#333] rounded" title="Add Audio Track" onClick={() => setLayers([...layers, { id: `l${Date.now()}`, name: 'New Audio', type: 'audio', visible: true, locked: false, muted: false }])}>
                                    <Music size={14} className="text-slate-400" />
                                </button>
                                <button className="p-1.5 hover:bg-[#333] rounded" title="Add Text Track" onClick={() => setLayers([...layers, { id: `l${Date.now()}`, name: 'New Text', type: 'text', visible: true, locked: false, muted: false }])}>
                                    <Type size={14} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setTimelineZoom(z => Math.max(0.2, z - 0.2))} className="p-1 hover:bg-[#333] rounded"><ZoomOut size={14} /></button>
                                <input 
                                    type="range" min="0.2" max="3" step="0.1" 
                                    value={timelineZoom} 
                                    onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
                                    className="w-24 accent-indigo-500 h-1 bg-[#333] rounded appearance-none"
                                />
                                <button onClick={() => setTimelineZoom(z => Math.min(3, z + 0.2))} className="p-1 hover:bg-[#333] rounded"><ZoomIn size={14} /></button>
                            </div>
                        </div>

                        {/* Tracks Container */}
                        <div className="flex-1 flex relative overflow-hidden">
                            {/* Left: Track Headers (Sticky) */}
                            <div className="w-48 bg-[#1e1e1e] border-r border-[#333] flex flex-col z-20 shadow-lg">
                                {/* Header Spacer */}
                                <div className="h-8 border-b border-[#333] bg-[#181818] flex items-center px-2">
                                    <span className="text-[10px] font-bold text-slate-500">TRACKS</span>
                                </div>
                                {/* Track List */}
                                <div className="flex-1 overflow-hidden">
                                    {layers.map(layer => (
                                        <div key={layer.id} className="h-20 border-b border-[#333] flex flex-col justify-center px-3 gap-1 hover:bg-[#252525] group relative">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    {layer.type === 'video' && <Video size={12} className="text-indigo-400" />}
                                                    {layer.type === 'audio' && <Music size={12} className="text-green-400" />}
                                                    {layer.type === 'text' && <Type size={12} className="text-orange-400" />}
                                                    <span className="text-xs font-medium truncate w-24">{layer.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setLayers(layers.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l))}>
                                                        {layer.visible ? <Eye size={12} /> : <EyeOff size={12} className="text-slate-500" />}
                                                    </button>
                                                    <button onClick={() => setLayers(layers.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l))}>
                                                        {layer.locked ? <Lock size={12} className="text-red-400" /> : <Unlock size={12} />}
                                                    </button>
                                                    {layer.type === 'audio' && (
                                                        <button onClick={() => setLayers(layers.map(l => l.id === layer.id ? { ...l, muted: !l.muted } : l))}>
                                                            {layer.muted ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Delete Btn */}
                                            <button 
                                                onClick={() => {
                                                     if(confirm('Delete this track?')) setLayers(layers.filter(l => l.id !== layer.id));
                                                }}
                                                className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/50 rounded text-red-400"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Timeline Content (Scrollable) */}
                            <div 
                                className="flex-1 overflow-auto relative bg-[#121212]" 
                                ref={timelineScrollRef}
                                onMouseMove={e => {
                                    if(dragging?.type === 'scrub') {
                                        handleTimelineMouseMove(e);
                                    }
                                }}
                                onMouseDown={e => {
                                     // Click on empty space to scrub
                                     if(e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('timeline-track')) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
                                        const newTime = Math.max(0, x / (PIXELS_PER_SECOND * timelineZoom));
                                        setCurrentTime(newTime);
                                        setDragging({ id: 'playhead', type: 'scrub', startX: e.clientX, initialStart: newTime, initialDuration: 0, initialOffset: 0 });
                                     }
                                }}
                            >
                                <div className="min-w-full relative" style={{ width: `${duration * PIXELS_PER_SECOND * timelineZoom}px`, minHeight: '100%' }}>
                                    {/* Ruler */}
                                    <div 
                                        className="h-8 border-b border-[#333] bg-[#181818] sticky top-0 z-10 flex items-end text-[10px] text-slate-500 cursor-pointer"
                                        onMouseDown={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const newTime = Math.max(0, x / (PIXELS_PER_SECOND * timelineZoom));
                                            setCurrentTime(newTime);
                                            setDragging({ id: 'playhead', type: 'scrub', startX: e.clientX, initialStart: newTime, initialDuration: 0, initialOffset: 0 });
                                        }}
                                    >
                                        {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
                                            <div key={i} className="absolute bottom-0 border-l border-[#444] h-3 pl-1 pointer-events-none" style={{ left: i * PIXELS_PER_SECOND * timelineZoom }}>
                                                {i % 5 === 0 && <span>{formatTime(i).split(':')[1]}:{formatTime(i).split(':')[2]}</span>}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Tracks */}
                                    <div className="flex flex-col">
                                        {layers.map(layer => (
                                            <div 
                                                key={layer.id} 
                                                className={`h-20 border-b border-[#333] relative timeline-track ${hoveredLayerId === layer.id ? 'bg-[#1a1a1a]' : ''}`}
                                                onDragOver={(e) => { e.preventDefault(); setHoveredLayerId(layer.id); }}
                                                onDragLeave={() => setHoveredLayerId(null)}
                                                onDrop={(e) => { setHoveredLayerId(null); handleDrop(e, layer.id); }}
                                            >
                                                {/* Clips */}
                                                {clips.filter(c => c.layerId === layer.id).map(clip => {
                                                    const style = getClipStyle(clip);
                                                    const isSelected = selectedClipId === clip.id;
                                                    
                                                    return (
                                                        <div 
                                                            key={clip.id}
                                                            className={`absolute top-2 h-16 rounded overflow-hidden cursor-pointer group border-2 ${isSelected ? 'border-indigo-500 z-10' : 'border-transparent hover:border-white/20'}`}
                                                            style={{ 
                                                                left: style.left, 
                                                                width: style.width,
                                                                backgroundColor: clip.type === 'video' ? '#312e81' : (clip.type === 'audio' ? '#064e3b' : '#7c2d12')
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (e.shiftKey) {
                                                                    const newSet = new Set(selectedClipIds);
                                                                    
                                                                    if (selectedClipId) {
                                                                        // Range selection
                                                                        const sortedClips = [...clips].sort((a, b) => a.start - b.start);
                                                                        const lastIdx = sortedClips.findIndex(c => c.id === selectedClipId);
                                                                        const currentIdx = sortedClips.findIndex(c => c.id === clip.id);
                                                                        
                                                                        if (lastIdx !== -1 && currentIdx !== -1) {
                                                                            const start = Math.min(lastIdx, currentIdx);
                                                                            const end = Math.max(lastIdx, currentIdx);
                                                                            
                                                                            for(let i = start; i <= end; i++) {
                                                                                newSet.add(sortedClips[i].id);
                                                                            }
                                                                        } else {
                                                                            // Fallback to simple toggle if something wrong
                                                                             if (newSet.has(clip.id)) newSet.delete(clip.id);
                                                                             else newSet.add(clip.id);
                                                                        }
                                                                    } else {
                                                                        // Simple toggle if no primary selection
                                                                        if (newSet.has(clip.id)) newSet.delete(clip.id);
                                                                        else newSet.add(clip.id);
                                                                    }
                                                                    
                                                                    setSelectedClipIds(newSet);
                                                                    // Update primary selection to the clicked one
                                                                    setSelectedClipId(clip.id);
                                                                } else {
                                                                    setSelectedClipId(clip.id);
                                                                    setSelectedClipIds(new Set([clip.id]));
                                                                }
                                                            }}
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setDragging({ 
                                                                    id: clip.id, 
                                                                    type: 'move', 
                                                                    startX: e.clientX, 
                                                                    initialStart: clip.start,
                                                                    initialDuration: clip.duration,
                                                                    initialOffset: clip.offset
                                                                });
                                                            }}
                                                        >
                                                            {/* Label */}
                                                            <div className="px-2 py-1 text-[10px] font-bold truncate text-white/90 drop-shadow-md pointer-events-none">
                                                                {clip.content || (clip.type === 'video' ? 'Video Clip' : 'Audio Clip')}
                                                            </div>

                                                            {/* Resize Handles */}
                                                            {isSelected && (
                                                                <>
                                                                    <div 
                                                                        className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize hover:bg-white/20 flex items-center justify-center"
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            setDragging({ 
                                                                                id: clip.id, 
                                                                                type: 'resize-start', 
                                                                                startX: e.clientX, 
                                                                                initialStart: clip.start, 
                                                                                initialDuration: clip.duration,
                                                                                initialOffset: clip.offset
                                                                            });
                                                                        }}
                                                                    >
                                                                        <GripVertical size={12} className="opacity-50" />
                                                                    </div>
                                                                    <div 
                                                                        className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-white/20 flex items-center justify-center"
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            setDragging({ 
                                                                                id: clip.id, 
                                                                                type: 'resize-end', 
                                                                                startX: e.clientX, 
                                                                                initialStart: clip.start, 
                                                                                initialDuration: clip.duration,
                                                                                initialOffset: clip.offset
                                                                            });
                                                                        }}
                                                                    >
                                                                        <GripVertical size={12} className="opacity-50" />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Playhead */}
                                    <div 
                                        className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
                                        style={{ left: currentTime * PIXELS_PER_SECOND * timelineZoom }}
                                    >
                                        <div className="w-3 h-3 -ml-1.5 bg-red-500 rotate-45 transform -translate-y-1.5"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Resize Handle */}
                <div 
                    className="w-1 bg-[#333] hover:bg-indigo-500 cursor-col-resize z-20 transition-colors"
                    onMouseDown={startResizeRight}
                />
                {/* 3. Right Sidebar (Inspector) */}
                <div className="bg-[#1e1e1e] border-l border-[#333] flex flex-col" style={{ width: rightSidebarWidth }}>
                    <div className="h-12 border-b border-[#333] flex items-center px-4">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-400">Inspector</span>
                    </div>

                    {selectedClip ? (
                        <div className="flex-1 overflow-y-auto">
                             {/* Tabs */}
                             <div className="flex border-b border-[#333]">
                                <button 
                                    onClick={() => setActiveInspectorTab('video')}
                                    className={`flex-1 py-3 text-xs font-bold ${activeInspectorTab === 'video' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500'}`}
                                >
                                    Video
                                </button>
                                {selectedClip.type !== 'text' && (
                                    <button 
                                        onClick={() => setActiveInspectorTab('audio')}
                                        className={`flex-1 py-3 text-xs font-bold ${activeInspectorTab === 'audio' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500'}`}
                                    >
                                        Audio
                                    </button>
                                )}
                                <button 
                                    onClick={() => setActiveInspectorTab('speed')}
                                    className={`flex-1 py-3 text-xs font-bold ${activeInspectorTab === 'speed' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500'}`}
                                >
                                    Speed
                                </button>
                             </div>

                             <div className="p-4 space-y-6">
                                {activeInspectorTab === 'video' && (
                                    <>
                                        <div className="space-y-3">
                                            <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                                <Move size={12} /> Transform
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <span className="text-[10px] text-slate-500 mb-1 block">Scale</span>
                                                    <input 
                                                        type="number" step="0.1" 
                                                        value={selectedClip.scale} 
                                                        onChange={(e) => updateSelectedClips({ scale: parseFloat(e.target.value) })}
                                                        className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-500 mb-1 block">Rotation</span>
                                                    <input 
                                                        type="number" 
                                                        value={selectedClip.rotation} 
                                                        onChange={(e) => updateSelectedClips({ rotation: parseFloat(e.target.value) })}
                                                        className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-500 mb-1 block">Pos X</span>
                                                    <input 
                                                        type="number" 
                                                        value={selectedClip.x} 
                                                        onChange={(e) => updateSelectedClips({ x: parseFloat(e.target.value) })}
                                                        className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-500 mb-1 block">Pos Y</span>
                                                    <input 
                                                        type="number" 
                                                        value={selectedClip.y} 
                                                        onChange={(e) => updateSelectedClips({ y: parseFloat(e.target.value) })}
                                                        className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                                    <Crop size={12} /> Crop
                                                </label>
                                                <button 
                                                    onClick={() => updateSelectedClips({ crop: { ...selectedClip.crop!, enabled: !selectedClip.crop?.enabled } })}
                                                    className={`text-[10px] px-2 py-0.5 rounded border ${selectedClip.crop?.enabled ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-[#333] text-slate-500'}`}
                                                >
                                                    {selectedClip.crop?.enabled ? 'ON' : 'OFF'}
                                                </button>
                                            </div>
                                            {selectedClip.crop?.enabled && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 mb-1 block">Top (%)</span>
                                                        <input 
                                                            type="number" min="0" max="100"
                                                            value={selectedClip.crop?.top || 0} 
                                                            onChange={(e) => updateSelectedClips({ crop: { ...selectedClip.crop!, top: parseFloat(e.target.value) } })}
                                                            className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 mb-1 block">Bottom (%)</span>
                                                        <input 
                                                            type="number" min="0" max="100"
                                                            value={selectedClip.crop?.bottom || 0} 
                                                            onChange={(e) => updateSelectedClips({ crop: { ...selectedClip.crop!, bottom: parseFloat(e.target.value) } })}
                                                            className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 mb-1 block">Left (%)</span>
                                                        <input 
                                                            type="number" min="0" max="100"
                                                            value={selectedClip.crop?.left || 0} 
                                                            onChange={(e) => updateSelectedClips({ crop: { ...selectedClip.crop!, left: parseFloat(e.target.value) } })}
                                                            className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 mb-1 block">Right (%)</span>
                                                        <input 
                                                            type="number" min="0" max="100"
                                                            value={selectedClip.crop?.right || 0} 
                                                            onChange={(e) => updateSelectedClips({ crop: { ...selectedClip.crop!, right: parseFloat(e.target.value) } })}
                                                            className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                                <Eye size={12} /> Opacity
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="range" min="0" max="1" step="0.01" 
                                                    value={selectedClip.opacity} 
                                                    onChange={(e) => updateSelectedClips({ opacity: parseFloat(e.target.value) })}
                                                    className="flex-1 accent-indigo-500 h-1 bg-[#333] rounded appearance-none"
                                                />
                                                <span className="text-xs font-mono w-10 text-right">{Math.round(selectedClip.opacity * 100)}%</span>
                                            </div>
                                        </div>

                                        {selectedClip.type === 'text' && (
                                            <div className="space-y-3 pt-4 border-t border-[#333]">
                                                <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                                    <Type size={12} /> Text Style
                                                </label>
                                                <textarea 
                                                    value={selectedClip.content}
                                                    onChange={(e) => updateSelectedClips({ content: e.target.value })}
                                                    className="w-full bg-[#121212] border border-[#333] rounded px-2 py-2 text-xs min-h-[60px]"
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 mb-1 block">Font Family</span>
                                                        <select 
                                                            value={selectedClip.fontFamily || 'Inter'} 
                                                            onChange={(e) => updateSelectedClips({ fontFamily: e.target.value })}
                                                            className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                        >
                                                            <option value="Inter">Inter</option>
                                                            <option value="Arial">Arial</option>
                                                            <option value="Helvetica">Helvetica</option>
                                                            <option value="Times New Roman">Times New Roman</option>
                                                            <option value="Courier New">Courier New</option>
                                                            <option value="Verdana">Verdana</option>
                                                            <option value="Georgia">Georgia</option>
                                                            <option value="Comic Sans MS">Comic Sans MS</option>
                                                            <option value="Impact">Impact</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 mb-1 block">Size</span>
                                                        <input 
                                                            type="number" 
                                                            value={selectedClip.fontSize} 
                                                            onChange={(e) => updateSelectedClips({ fontSize: parseInt(e.target.value) })}
                                                            className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 mb-1 block">Color</span>
                                                        <div className="flex gap-1">
                                                            <input 
                                                                type="color" 
                                                                value={selectedClip.color} 
                                                                onChange={(e) => updateSelectedClips({ color: e.target.value })}
                                                                className="h-6 w-full bg-transparent cursor-pointer"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 bg-[#121212] p-1 rounded border border-[#333]">
                                                    <button 
                                                        onClick={() => updateSelectedClips({ textAlign: 'left' })}
                                                        className={`flex-1 p-1 rounded ${selectedClip.textAlign === 'left' ? 'bg-[#333]' : 'hover:bg-[#222]'}`}
                                                    >
                                                        <AlignLeft size={14} className="mx-auto"/>
                                                    </button>
                                                    <button 
                                                        onClick={() => updateSelectedClips({ textAlign: 'center' })}
                                                        className={`flex-1 p-1 rounded ${selectedClip.textAlign === 'center' ? 'bg-[#333]' : 'hover:bg-[#222]'}`}
                                                    >
                                                        <AlignCenter size={14} className="mx-auto"/>
                                                    </button>
                                                    <button 
                                                        onClick={() => updateSelectedClips({ textAlign: 'right' })}
                                                        className={`flex-1 p-1 rounded ${selectedClip.textAlign === 'right' ? 'bg-[#333]' : 'hover:bg-[#222]'}`}
                                                    >
                                                        <AlignRight size={14} className="mx-auto"/>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {activeInspectorTab === 'audio' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                                <Volume2 size={12} /> Volume
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="range" min="0" max="1" step="0.01" 
                                                    value={selectedClip.volume} 
                                                    onChange={(e) => updateSelectedClips({ volume: parseFloat(e.target.value) })}
                                                    className="flex-1 accent-green-500 h-1 bg-[#333] rounded appearance-none"
                                                />
                                                <span className="text-xs font-mono w-10 text-right">{Math.round(selectedClip.volume * 100)}%</span>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                                <Ghost size={12} /> Fade In/Out (s)
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <span className="text-[10px] text-slate-500 mb-1 block">Fade In</span>
                                                    <input 
                                                        type="number" step="0.1" min="0"
                                                        value={selectedClip.fadeIn || 0} 
                                                        onChange={(e) => updateSelectedClips({ fadeIn: parseFloat(e.target.value) })}
                                                        className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-500 mb-1 block">Fade Out</span>
                                                    <input 
                                                        type="number" step="0.1" min="0"
                                                        value={selectedClip.fadeOut || 0} 
                                                        onChange={(e) => updateSelectedClips({ fadeOut: parseFloat(e.target.value) })}
                                                        className="w-full bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeInspectorTab === 'speed' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                                <Clock size={12} /> Playback Speed
                                            </label>
                                            <div className="flex items-center gap-4">
                                                <input 
                                                    type="range" min="0.25" max="4" step="0.25" 
                                                    value={selectedClip.speed || 1} 
                                                    onChange={(e) => updateSelectedClips({ speed: parseFloat(e.target.value) })}
                                                    className="flex-1 accent-indigo-500 h-1 bg-[#333] rounded appearance-none"
                                                />
                                                <span className="text-xs font-mono w-12 text-right">{selectedClip.speed || 1}x</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-slate-500">
                                                <span>0.25x</span>
                                                <span>1x</span>
                                                <span>4x</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                            <MousePointer2 size={32} className="mb-2 opacity-50" />
                            <span className="text-xs">Select a clip to edit</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Render Modal */}
            {renderModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl w-96 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Video size={20} className="text-emerald-500" /> Render Video
                            </h3>
                            <button onClick={() => setRenderModalOpen(false)} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Resolution</label>
                                <select 
                                    value={renderResolution}
                                    onChange={(e) => setRenderResolution(e.target.value)}
                                    className="w-full bg-[#121212] border border-[#333] rounded p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="4k">4K Ultra HD (3840x2160)</option>
                                    <option value="1440p">1440p Quad HD (2560x1440)</option>
                                    <option value="1080p">1080p Full HD (1920x1080)</option>
                                    <option value="720p">720p HD (1280x720)</option>
                                    <option value="480p">480p SD (854x480)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Format</label>
                                <select 
                                    value={renderFormat}
                                    onChange={(e) => setRenderFormat(e.target.value)}
                                    className="w-full bg-[#121212] border border-[#333] rounded p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="mp4">MP4 (H.264)</option>
                                    <option value="webm">WebM (VP9)</option>
                                    <option value="mov">MOV (ProRes)</option>
                                    <option value="gif">GIF (Animated)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setRenderModalOpen(false)}
                                className="px-4 py-2 rounded text-sm font-medium text-slate-400 hover:text-white hover:bg-[#333]"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleRender}
                                className="px-4 py-2 rounded text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
                            >
                                Start Render
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
