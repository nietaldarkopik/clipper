import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Square, Video, Save, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { uploadVideoFile } from '../api';

interface RecorderProps {
    onClose: () => void;
    onSaved: () => void;
}

export const Recorder = ({ onClose, onSaved }: RecorderProps) => {
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
    const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
    
    const [isRecording, setIsRecording] = useState(false);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const recordedChunksRef = useRef<Blob[]>([]); // Ref to hold latest chunks
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        getDevices();
        return () => {
            stopStream();
        };
    }, []);

    useEffect(() => {
        if (selectedVideoDevice && selectedAudioDevice) {
            startStream();
        }
    }, [selectedVideoDevice, selectedAudioDevice]);

    const getDevices = async () => {
        try {
            // Request permission first to get labels
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            
            setVideoDevices(videoInputs);
            setAudioDevices(audioInputs);

            if (videoInputs.length > 0) setSelectedVideoDevice(videoInputs[0].deviceId);
            if (audioInputs.length > 0) setSelectedAudioDevice(audioInputs[0].deviceId);
        } catch (error) {
            console.error("Error accessing media devices:", error);
            alert("Could not access camera/microphone. Please check permissions.");
        }
    };

    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const startStream = async () => {
        stopStream();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: selectedVideoDevice } },
                audio: { deviceId: { exact: selectedAudioDevice } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error("Failed to start stream:", error);
        }
    };

    const handleStartRecording = () => {
        if (!streamRef.current) return;
        
        setRecordedChunks([]);
        recordedChunksRef.current = []; // Reset ref
        
        const mediaRecorder = new MediaRecorder(streamRef.current, {
            mimeType: 'video/webm;codecs=vp9,opus'
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                setRecordedChunks(prev => [...prev, event.data]);
                recordedChunksRef.current.push(event.data); // Update ref
            }
        };

        mediaRecorder.onstop = () => {
            // Handle blob creation in onstop to ensure all chunks are captured
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            if (blob.size > 0) {
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
            }
            stopStream(); // Stop camera when reviewing
            setIsRecording(false);
        };

        mediaRecorder.start(1000); // Start with 1s timeslice to get frequent chunks
        setIsRecording(true);
        mediaRecorderRef.current = mediaRecorder;
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const handleRetake = () => {
        setPreviewUrl(null);
        setRecordedChunks([]);
        recordedChunksRef.current = []; // Reset ref
        startStream();
    };

    const handleSave = async () => {
        if (recordedChunksRef.current.length === 0) return;
        setIsSaving(true);
        try {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            await uploadVideoFile(blob, `recording_${Date.now()}.webm`);
            alert("Recording saved to Library!");
            onSaved();
            onClose();
        } catch (error) {
            console.error("Failed to save recording:", error);
            alert("Failed to save recording.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] w-[800px] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#141414]">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                        <Video className="text-red-500" /> Record Video
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {/* Device Selection */}
                    {!previewUrl && (
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 flex items-center gap-2">
                                    <Camera size={14} /> Camera
                                </label>
                                <select 
                                    className="w-full bg-[#252525] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    value={selectedVideoDevice}
                                    onChange={(e) => setSelectedVideoDevice(e.target.value)}
                                    disabled={isRecording}
                                >
                                    {videoDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 flex items-center gap-2">
                                    <Mic size={14} /> Microphone
                                </label>
                                <select 
                                    className="w-full bg-[#252525] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    value={selectedAudioDevice}
                                    onChange={(e) => setSelectedAudioDevice(e.target.value)}
                                    disabled={isRecording}
                                >
                                    {audioDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Mic ${device.deviceId.slice(0, 5)}...`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Video Preview */}
                    <div className="aspect-video bg-black rounded-xl overflow-hidden relative border border-white/10 mb-6 group">
                        {previewUrl ? (
                            <video src={previewUrl} controls className="w-full h-full object-contain" />
                        ) : (
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                        )}
                        
                        {isRecording && (
                            <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/90 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                                RECORDING
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-4">
                        {!previewUrl ? (
                            !isRecording ? (
                                <button 
                                    onClick={handleStartRecording}
                                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold transition-all hover:scale-105 shadow-lg shadow-red-600/20"
                                >
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                    Start Recording
                                </button>
                            ) : (
                                <button 
                                    onClick={handleStopRecording}
                                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-full font-bold transition-all hover:scale-105"
                                >
                                    <Square size={16} fill="currentColor" />
                                    Stop Recording
                                </button>
                            )
                        ) : (
                            <>
                                <button 
                                    onClick={handleRetake}
                                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-semibold transition"
                                >
                                    <RefreshCw size={18} />
                                    Retake
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded-lg font-bold transition hover:scale-105 disabled:opacity-50 disabled:scale-100"
                                >
                                    {isSaving ? (
                                        <>Saving...</>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            Save to Library
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
