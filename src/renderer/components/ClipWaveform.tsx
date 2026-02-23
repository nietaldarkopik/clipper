import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface ClipWaveformProps {
    src: string;
    height?: number;
    color?: string;
    progressColor?: string;
}

const ClipWaveform: React.FC<ClipWaveformProps> = ({ src, height = 40, color = 'rgba(255, 255, 255, 0.5)', progressColor = 'rgba(255, 255, 255, 0.8)' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);

    useEffect(() => {
        if (!containerRef.current || !src) return;

        console.log('[ClipWaveform] Initializing for:', src);

        // Destroy previous instance if exists
        if (wavesurfer.current) {
            wavesurfer.current.destroy();
        }

        try {
            wavesurfer.current = WaveSurfer.create({
                container: containerRef.current,
                waveColor: color,
                progressColor: progressColor,
                cursorWidth: 0,
                height: height,
                normalize: true,
                interact: false,
                url: src,
                barWidth: 2,
                barGap: 1,
                barRadius: 2,
                fillParent: true,
                minPxPerSec: 1,
                // Add specific options for v7 compatibility if needed
                backend: 'MediaElement', // Better for large files/videos
            });

            wavesurfer.current.on('ready', () => {
                console.log('[ClipWaveform] Ready:', src);
            });

            wavesurfer.current.on('error', (err) => {
                console.error('[ClipWaveform] Error:', src, err);
            });

        } catch (e) {
            console.error("[ClipWaveform] Failed to create waveform", e);
        }

        return () => {
            wavesurfer.current?.destroy();
        };
    }, [src, height, color, progressColor]);

    return (
        <div 
            ref={containerRef} 
            className="absolute inset-0 z-0 pointer-events-none opacity-60 w-full h-full" 
            style={{ display: 'block', minWidth: '100%' }} // Force display
        />
    );
};

export default ClipWaveform;
