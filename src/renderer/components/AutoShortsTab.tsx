import React, { useEffect, useState } from 'react';
import { Sparkles, Film, Scissors, Loader2, Wand2, CheckCircle2 } from 'lucide-react';
import { getLibraryVideos, getVideo, analyzeVideo, getTranscripts, generateHighlights, saveClips, clipVideo } from '../api';

const formatDuration = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const AutoShortsTab: React.FC = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingHighlights, setIsGeneratingHighlights] = useState(false);
  const [isProcessingClips, setIsProcessingClips] = useState(false);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadVideos = async () => {
    setIsLoadingVideos(true);
    try {
      const data = await getLibraryVideos();
      if (Array.isArray(data)) {
        setVideos(data);
      } else if (data && Array.isArray(data.videos)) {
        setVideos(data.videos);
      } else {
        setVideos([]);
      }
    } catch {
      setVideos([]);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideoDetails = async (videoId: string) => {
    setSelectedVideoId(videoId);
    setSelectedVideo(null);
    setHighlights([]);
    setSelectedHighlightIds(new Set());
    setStatusMessage(null);
    try {
      const data = await getVideo(videoId);
      setSelectedVideo(data);
      if (data && Array.isArray(data.clips)) {
        setHighlights(data.clips);
        setSelectedHighlightIds(new Set(data.clips.map((c: any) => c.id)));
      }
    } catch {
      setSelectedVideo(null);
      setHighlights([]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedVideoId) return;
    if (!confirm('Analisis AI akan men-transkrip video ini. Lanjutkan?')) return;
    setIsAnalyzing(true);
    setStatusMessage(null);
    try {
      const res = await analyzeVideo(selectedVideoId);
      if (res && res.jobId) {
        setStatusMessage('Analysis started. You can continue while processing runs in background.');
      } else {
        setStatusMessage('Analysis started.');
      }
    } catch {
      alert('Gagal memulai analisis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateHighlights = async () => {
    if (!selectedVideoId) return;
    setIsGeneratingHighlights(true);
    setStatusMessage(null);
    try {
      const transcripts = await getTranscripts(selectedVideoId);
      if (!transcripts || transcripts.length === 0) {
        alert('Tidak ada transcript. Jalankan analisis terlebih dahulu.');
        return;
      }
      const transcriptText = transcripts[0].content.text || transcripts[0].content;
      if (!transcriptText) {
        alert('Transcript tidak valid.');
        return;
      }
      const result = await generateHighlights(transcriptText);
      if (result.highlights && result.highlights.length > 0) {
        await saveClips(selectedVideoId, result.highlights);
        const refreshed = await getVideo(selectedVideoId);
        setSelectedVideo(refreshed);
        const clips = Array.isArray(refreshed.clips) ? refreshed.clips : [];
        setHighlights(clips);
        setSelectedHighlightIds(new Set(clips.map((c: any) => c.id)));
        setStatusMessage(`Generated ${result.highlights.length} highlights.`);
      } else {
        alert('Tidak ada highlight yang ditemukan.');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.details || error?.response?.data?.error || error?.message || 'Unknown error';
      alert(`Gagal generate highlights: ${msg}`);
    } finally {
      setIsGeneratingHighlights(false);
    }
  };

  const toggleHighlight = (id: string) => {
    setSelectedHighlightIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllHighlights = () => {
    if (!highlights.length) return;
    setSelectedHighlightIds(prev => {
      if (prev.size === highlights.length) return new Set();
      return new Set(highlights.map(h => h.id));
    });
  };

  const handleProcessSelectedHighlights = async () => {
    if (!highlights.length || selectedHighlightIds.size === 0) return;
    setIsProcessingClips(true);
    setStatusMessage(null);
    try {
      const toProcess = highlights.filter(h => selectedHighlightIds.has(h.id));
      for (const clip of toProcess) {
        const duration = (clip.end_time || 0) - (clip.start_time || 0);
        if (!clip.video_id || duration <= 0) continue;
        try {
          await clipVideo(clip.video_id, clip.start_time, duration, clip.id);
        } catch {}
      }
      setStatusMessage(`Started processing ${toProcess.length} clips. Check Library for processed results.`);
    } finally {
      setIsProcessingClips(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0f0f0f] p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              Auto Shorts Mode
            </h2>
            <p className="text-xs text-slate-400">
              Pilih video panjang dari Library, biarkan AI membuat highlight dan short otomatis.
            </p>
          </div>
        </div>
        <button
          onClick={loadVideos}
          className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-xs text-slate-300 hover:bg-[#252525] flex items-center gap-2"
        >
          <Film size={14} />
          Refresh Library
        </button>
      </div>

      <div className="flex gap-6 h-full min-h-0">
        <div className="w-80 flex-shrink-0 flex flex-col bg-[#111111] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <FolderOpenIcon /> Library Videos
            </span>
            {isLoadingVideos && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoadingVideos ? (
              <div className="flex items-center justify-center h-40 text-slate-500 text-xs">
                Memuat video...
              </div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-xs px-4 text-center">
                Belum ada video di Library. Download dari Browser atau upload terlebih dahulu.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {videos.map(video => (
                  <button
                    key={video.id}
                    onClick={() => loadVideoDetails(video.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl text-left text-xs transition border ${selectedVideoId === video.id ? 'border-emerald-500/60 bg-emerald-500/10 text-slate-100' : 'border-transparent bg-[#151515] hover:bg-[#1e1e1e] text-slate-300'}`}
                  >
                    <div className="w-12 h-8 rounded-lg bg-black overflow-hidden flex-shrink-0">
                      {video.thumbnail ? (
                        <img src={video.thumbnail} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600">
                          <Film size={14} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold truncate">{video.title || 'Untitled'}</div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                        <span className="truncate max-w-[120px]">{video.platform || video.source || 'Local'}</span>
                        {video.duration && (
                          <span>{formatDuration(video.duration)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-[#111111] border border-white/5 rounded-2xl p-6 min-h-0">
          {!selectedVideo ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm">
              <Sparkles size={32} className="mb-3 text-emerald-400" />
              <p>Pilih satu video dari Library di sebelah kiri untuk mulai membuat Auto Shorts.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-40 h-24 rounded-xl bg-black overflow-hidden">
                    {selectedVideo.thumbnail ? (
                      <img src={selectedVideo.thumbnail} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                        <Film size={20} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                      {selectedVideo.title || 'Untitled Video'}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 max-w-xl">
                      {selectedVideo.description || selectedVideo.channel || selectedVideo.url || 'Video dari Library'}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                      {selectedVideo.duration && (
                        <span>Durasi: {formatDuration(selectedVideo.duration)}</span>
                      )}
                      {selectedVideo.platform && (
                        <span>Platform: {selectedVideo.platform}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                      {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                      Analyze & Transcribe
                    </button>
                    <button
                      onClick={handleGenerateHighlights}
                      disabled={isGeneratingHighlights}
                      className="px-3 py-1.5 rounded-lg bg-pink-600/20 text-pink-400 hover:bg-pink-600 hover:text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingHighlights ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
                      Generate Highlights
                    </button>
                  </div>
                  <button
                    onClick={handleProcessSelectedHighlights}
                    disabled={isProcessingClips || selectedHighlightIds.size === 0}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {isProcessingClips ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Process Selected Clips
                  </button>
                  {statusMessage && (
                    <div className="text-[10px] text-emerald-300 mt-1 max-w-xs text-right">
                      {statusMessage}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">AI Highlights</h4>
                  <p className="text-[11px] text-slate-500">
                    Klip-klip pendek yang disarankan AI dari video ini.
                  </p>
                </div>
                <button
                  onClick={handleSelectAllHighlights}
                  disabled={!highlights.length}
                  className="px-3 py-1 rounded-lg bg-[#1a1a1a] text-[10px] text-slate-300 border border-white/10 hover:bg-[#252525] disabled:opacity-50"
                >
                  {selectedHighlightIds.size === highlights.length ? 'Batalkan Semua' : 'Pilih Semua'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-[#0c0c0c] p-3">
                {highlights.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-xs">
                    <Scissors size={20} className="mb-2 text-slate-600" />
                    <p>Belum ada highlights untuk video ini.</p>
                    <p className="text-[10px] text-slate-500 mt-1">Jalankan Analyze dan Generate Highlights terlebih dahulu.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {highlights.map((clip: any) => (
                      <button
                        key={clip.id}
                        onClick={() => toggleHighlight(clip.id)}
                        className={`flex flex-col items-stretch rounded-xl border p-3 text-left text-xs transition group ${selectedHighlightIds.has(clip.id) ? 'border-emerald-500/70 bg-emerald-500/10' : 'border-slate-700 bg-[#141414] hover:border-emerald-500/40 hover:bg-emerald-500/5'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-slate-100 truncate">
                            {clip.title || `Highlight ${formatDuration(clip.start_time || 0)} - ${formatDuration(clip.end_time || 0)}`}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDuration(clip.start_time || 0)} - {formatDuration(clip.end_time || 0)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">
                          {clip.description || 'Highlight dari AI'}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>{clip.score ? `Score: ${clip.score.toFixed ? clip.score.toFixed(2) : clip.score}` : 'AI Highlight'}</span>
                          <span className={`px-2 py-0.5 rounded-full ${selectedHighlightIds.has(clip.id) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                            {selectedHighlightIds.has(clip.id) ? 'Dipilih' : 'Klik untuk pilih'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const FolderOpenIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2" />
  </svg>
);

