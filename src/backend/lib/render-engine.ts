import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs-extra';

interface Clip {
    id: string;
    type: 'video' | 'audio' | 'text' | 'image';
    src?: string;
    content?: string;
    start: number;
    duration: number;
    offset: number;
    layerId: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity: number;
    volume: number;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    fontFamily?: string;
    width?: number;
    height?: number;
    crop?: {
        enabled: boolean;
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    speed?: number;
}

interface Layer {
    id: string;
    visible: boolean;
    muted?: boolean;
}

interface RenderOptions {
    width: number;
    height: number;
    fps: number;
    outputPath: string;
}

export const renderProjectVideo = async (
    layers: Layer[],
    clips: Clip[],
    duration: number,
    options: RenderOptions
) => {
    return new Promise((resolve, reject) => {
        const { width, height, fps, outputPath } = options;
        
        const cmd = ffmpeg();
        
        // 0. Base Video (Black Background)
        cmd.input(`color=c=black:s=${width}x${height}:d=${duration}:r=${fps}`)
           .inputFormat('lavfi');
           
        // 1. Base Audio (Silence) - used for duration and base
        cmd.input(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration}`)
           .inputFormat('lavfi');

        const visibleLayerIds = new Set(layers.filter(l => l.visible).map(l => l.id));
        const mutedLayerIds = new Set(layers.filter(l => l.muted).map(l => l.id));
        
        // Sort layers for Z-index (bottom to top)
        // In AdvancedVideoEditor, index 0 is typically the bottom layer visually (Main Video)
        const layerZIndex = new Map(layers.map((l, i) => [l.id, i]));
        
        const activeClips = clips.filter(c => visibleLayerIds.has(c.layerId));
        
        // Sort clips: Z-index asc, then start time asc
        activeClips.sort((a, b) => {
            const zA = layerZIndex.get(a.layerId) || 0;
            const zB = layerZIndex.get(b.layerId) || 0;
            if (zA !== zB) return zA - zB;
            return a.start - b.start;
        });

        let inputIndex = 2; // Starts after color and anullsrc
        let filterComplex: string[] = [];
        let currentV = '[0:v]';
        let audioStreams: string[] = [];
        
        // We will add [1:a] (silence) to the mix later if needed
        
        activeClips.forEach((clip) => {
            const clipDuration = clip.duration;
            const clipStart = clip.start;
            const clipOffset = clip.offset;
            const speed = clip.speed || 1;
            const isMuted = mutedLayerIds.has(clip.layerId) || (clip.volume === 0);
            
            // --- Video/Image Handling ---
            if (clip.type === 'video' || clip.type === 'image') {
                if (clip.src) {
                    cmd.input(clip.src);
                    const idx = inputIndex++;
                    
                    // Video Chain
                    let vChain = `[${idx}:v]`;
                    
                    // 1. Trim (Source Time)
                    if (clip.type === 'video') {
                         vChain += `trim=${clipOffset}:${clipOffset + (clipDuration * speed)},setpts=PTS-STARTPTS`;
                    } else {
                         // Image: loop to duration
                         // Use loop filter to repeat the image
                         vChain += `loop=loop=-1:size=1:start=0,trim=0:${clipDuration},setpts=PTS-STARTPTS`;
                    }

                    // 2. Crop
                    if (clip.crop && clip.crop.enabled) {
                         const cw = `iw*${(100 - clip.crop.left - clip.crop.right)/100}`;
                         const ch = `ih*${(100 - clip.crop.top - clip.crop.bottom)/100}`;
                         const cx = `iw*${clip.crop.left/100}`;
                         const cy = `ih*${clip.crop.top/100}`;
                         vChain += `,crop=${cw}:${ch}:${cx}:${cy}`;
                    }

                    // 3. Scale
                    if (clip.scale !== 1) {
                        vChain += `,scale=iw*${clip.scale}:ih*${clip.scale}`;
                    }

                    // 4. Rotate
                    if (clip.rotation) {
                         vChain += `,rotate=${clip.rotation}*PI/180:c=none`;
                    }
                    
                    // 5. Speed (Video)
                    if (speed !== 1) {
                        vChain += `,setpts=${1/speed}*PTS`;
                    }
                    
                    // 6. Time Shift (Start time on timeline)
                    vChain += `,setpts=PTS+${clipStart}/TB`;
                    
                    // 7. Opacity
                    if (clip.opacity < 1) {
                         vChain += `,format=rgba,colorchannelmixer=aa=${clip.opacity}`;
                    }

                    const outLabel = `[v${idx}]`;
                    vChain += `${outLabel}`;
                    filterComplex.push(vChain);

                    // Overlay
                    // enable='between...' handles visibility timing
                    const nextV = `[tmp${idx}]`;
                    filterComplex.push(`${currentV}${outLabel}overlay=x=${clip.x}:y=${clip.y}:enable='between(t,${clipStart},${clipStart + clipDuration})':eof_action=pass${nextV}`);
                    currentV = nextV;
                    
                    // --- Audio Handling (Video with Audio) ---
                    if (!isMuted && clip.type === 'video') {
                        // Attempt to use audio stream from video input
                        let aChain = `[${idx}:a]`;
                        
                        // 1. Trim (Source Time)
                        aChain += `atrim=start=${clipOffset}:end=${clipOffset + (clipDuration * speed)},asetpts=PTS-STARTPTS`;
                        
                        // 2. Speed (Audio)
                        if (speed !== 1) {
                            aChain += `,atempo=${speed}`;
                        }
                        
                        // 3. Volume
                        if (clip.volume !== 1) {
                            aChain += `,volume=${clip.volume}`;
                        }
                        
                        // 4. Delay (Start time)
                        const delayMs = Math.floor(clipStart * 1000);
                        aChain += `,adelay=${delayMs}|${delayMs}`;
                        
                        const aLabel = `[a${idx}]`;
                        aChain += `${aLabel}`;
                        filterComplex.push(aChain);
                        audioStreams.push(aLabel);
                    }
                }
            } 
            
            // --- Audio Handling (Audio Clips) ---
            else if (clip.type === 'audio') {
                 if (clip.src && !isMuted) {
                    cmd.input(clip.src);
                    const idx = inputIndex++;
                    
                    let aChain = `[${idx}:a]`;
                    
                    // 1. Trim
                    aChain += `atrim=start=${clipOffset}:end=${clipOffset + (clipDuration * speed)},asetpts=PTS-STARTPTS`;
                    
                    // 2. Speed
                    if (speed !== 1) {
                         aChain += `,atempo=${speed}`;
                    }
                    
                    // 3. Volume
                    if (clip.volume !== 1) {
                        aChain += `,volume=${clip.volume}`;
                    }
                    
                    // 4. Delay
                    const delayMs = Math.floor(clipStart * 1000);
                    aChain += `,adelay=${delayMs}|${delayMs}`;
                    
                    const aLabel = `[a${idx}]`;
                    aChain += `${aLabel}`;
                    filterComplex.push(aChain);
                    audioStreams.push(aLabel);
                 }
            }
            
            // --- Text Handling ---
            else if (clip.type === 'text') {
                 const txtIdx = `txt${Math.random().toString(36).substr(2,5)}`;
                 const textStream = `[${txtIdx}]`;
                 
                 // Escape text for ffmpeg drawtext
                 const content = (clip.content || '').replace(/:/g, '\\\\:').replace(/'/g, "'\\\\\\\\''");
                 const fontSize = clip.fontSize || 48;
                 const fontColor = clip.color || 'white';
                 // Simple font mapping for Windows
                 let fontFile = 'Arial'; // Default fallback
                 if (clip.fontFamily) {
                    const f = clip.fontFamily.toLowerCase();
                    if (f.includes('serif')) fontFile = 'Times New Roman';
                    else if (f.includes('mono')) fontFile = 'Consolas';
                    else if (f.includes('comic')) fontFile = 'Comic Sans MS';
                    else if (f.includes('impact')) fontFile = 'Impact';
                 }
                 
                 // Create transparent video with text
                 // 1. Generate Text on transparent background
                 let tChain = `color=c=black@0:s=${width}x${height}:d=${clipDuration}:r=${fps},drawtext=text='${content}':fontcolor=${fontColor}:fontsize=${fontSize}:x=${clip.x}:y=${clip.y}:font='${fontFile}'`;
                 
                 // 2. Rotate if needed
                 if (clip.rotation) {
                     tChain += `,rotate=${clip.rotation}*PI/180:c=black@0:ow=rotw(iw):oh=roth(ih)`;
                 }

                 // 3. Opacity
                 if (clip.opacity < 1) {
                     tChain += `,format=rgba,colorchannelmixer=aa=${clip.opacity}`;
                 }
                 
                 // 4. Time Shift
                 tChain += `,trim=0:${clipDuration},setpts=PTS-STARTPTS+${clipStart}/TB`;
                 
                 tChain += `${textStream}`;
                 filterComplex.push(tChain);
                 
                 const nextV = `[tmp_txt_${txtIdx}]`;
                 filterComplex.push(`${currentV}${textStream}overlay=0:0:enable='between(t,${clipStart},${clipStart + clipDuration})':eof_action=pass${nextV}`);
                 currentV = nextV;
            }
        });

        // Mix Audio
        const mixedAudio = '[outa]';
        let hasAudio = false;

        if (audioStreams.length > 0) {
            // Mix all audio streams with the base silence
            // Order: [Silence], [A1], [A2]...
            // duration=first (Silence is full duration)
            // normalize=0 (Additive mixing)
            const inputs = ['[1:a]', ...audioStreams];
            filterComplex.push(`${inputs.join('')}amix=inputs=${inputs.length}:duration=first:dropout_transition=0:normalize=0${mixedAudio}`);
            hasAudio = true;
        } else {
            // Just silence
            // We can map [1:a] directly
        }

        if (filterComplex.length > 0) {
            if (hasAudio) {
                cmd.complexFilter(filterComplex, [currentV, mixedAudio]);
            } else {
                cmd.complexFilter(filterComplex, [currentV, '[1:a]']);
            }
        } else {
            // No clips
             cmd.complexFilter([], ['[0:v]', '[1:a]']);
        }

        cmd.output(outputPath)
           .on('start', (c) => console.log('Render started:', c))
           .on('end', () => resolve(outputPath))
           .on('error', (err) => reject(err))
           .run();
    });
};
