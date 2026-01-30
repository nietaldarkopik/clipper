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
  CloudUpload,
  History,
  Hash,
  FileText,
  Tag,
  Loader2,
  ListVideo
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('research'); // research | editor | captions | publish
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  // State untuk Metadata
  const [metadata, setMetadata] = useState({
    title: '',
    description: '',
    hashtags: '',
    category: 'Entertainment',
    targetAudience: 'General'
  });

  // Mock Data untuk Library & History
  const [processingList] = useState([
    { id: 1, name: 'Highlight_Gaming_01.mp4', progress: 65, status: 'Rendering' },
    { id: 2, name: 'Podcast_Short_Clip.mp4', progress: 20, status: 'Uploading' }
  ]);

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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Masukkan kata kunci (misal: 'ASMR Cooking')..." 
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button className="bg-white/5 hover:bg-white/10 px-6 rounded-xl text-sm font-medium border border-white/5 transition">
          Cari Konten
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden group">
            <div className="h-44 bg-slate-800 relative flex items-center justify-center">
              <span className="text-slate-600 text-xs">Video Thumbnail {i}</span>
              <div className="absolute top-2 right-2 bg-indigo-600 text-[10px] font-bold px-2 py-1 rounded">TRENDING</div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                 <button className="p-3 bg-white text-black rounded-full hover:scale-110 transition"><Download size={20} /></button>
                 <button className="p-3 bg-indigo-600 text-white rounded-full hover:scale-110 transition"><Scissors size={20} /></button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-1">Judul Video Viral #{i}</h3>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                <span>YouTube • 1.2M Views</span>
                <span className="text-green-400 font-bold">+24% Pertumbuhan</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold transition">
                   Pratinjau
                </button>
                <button className="flex-1 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-[11px] font-bold transition">
                   Download & Clip
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // --- SUB-HALAMAN: EDITOR ---
  const EditorTab = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#141414]">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold">VLOG_RAHASIA_SUKSES.mp4</span>
          <span className="text-slate-500">|</span>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold bg-indigo-400/10 px-2 py-1 rounded">
             <CheckCircle2 size={12} /> Video Siap Digabung
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setIsProcessingAI(true);
              setTimeout(() => setIsProcessingAI(false), 3000);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            {isProcessingAI ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            AI Highlight Detect
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

              {/* Daftar Klip Terpotong */}
              <section>
                 <h4 className="text-[9px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <ListVideo size={10} /> Koleksi Klip Saya
                 </h4>
                 <div className="space-y-2">
                    {savedClips.map(clip => (
                       <div key={clip.id} className="p-2 rounded bg-white/5 border border-white/5 hover:border-indigo-500/30 cursor-pointer flex items-center justify-between group">
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

      <footer className="h-40 bg-[#1a1a1a] border-t border-white/5 p-4">
         <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Multi-Clip Timeline</span>
            <div className="flex gap-2 text-[10px]">
               <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg flex items-center gap-2 border border-white/5 transition">
                  <Scissors size={14} /> Split Clip
               </button>
            </div>
         </div>
         <div className="h-16 bg-black/40 rounded-xl border border-white/5 relative overflow-hidden mx-2">
            <div className="absolute top-0 bottom-0 left-[10%] w-[30%] bg-indigo-600/20 border-x-2 border-indigo-500 flex items-center justify-center text-[9px] font-bold">INTRO_HOOK</div>
            <div className="absolute top-0 bottom-0 left-[45%] w-[40%] bg-indigo-600/20 border-x-2 border-indigo-500 flex items-center justify-center text-[9px] font-bold">MAIN_CONTENT_01</div>
            <div className="absolute top-0 bottom-0 left-1/3 w-0.5 bg-red-500 shadow-[0_0_8px_red]"></div>
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
               <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                  <FileText size={12} /> Edit Transkrip
               </h3>
               <div className="space-y-3">
                  {[
                    { t: "00:01", s: "Inilah cara rahasia sukses..." },
                    { t: "00:04", s: "Pertama, anda harus konsisten." },
                    { t: "00:07", s: "Kedua, gunakan data riset viral." }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 focus-within:border-indigo-500/50 transition-all flex gap-3">
                       <span className="text-[10px] font-mono text-indigo-400 mt-0.5">{item.t}</span>
                       <textarea 
                         className="flex-1 bg-transparent text-[11px] text-slate-200 focus:outline-none resize-none leading-relaxed" 
                         rows="1"
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
             <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <CloudUpload className="text-indigo-500" /> Publikasi Konten
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
                     rows="4"
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
                   <button className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-indigo-500 transition active:scale-95 shadow-xl shadow-indigo-500/20">
                      <Share2 size={20} /> Upload Sekarang
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
      <aside className="w-20 flex flex-col items-center py-10 bg-[#1a1a1a] border-r border-white/5 space-y-12">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 cursor-pointer hover:rotate-6 transition-transform">
          <Video size={26} className="text-white" />
        </div>
        <nav className="flex flex-col space-y-10">
          {[
            { id: 'research', icon: <Search size={22} />, title: 'Research' },
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
           <button className="text-slate-600 hover:text-white transition"><History size={20} /></button>
           <button className="text-slate-600 hover:text-white transition"><Settings size={20} /></button>
           <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">JD</div>
        </div>
      </aside>

      {/* Kontainer Aplikasi */}
      <main className="flex-1 flex flex-col overflow-hidden">
         {activeTab === 'research' && <ResearchTab />}
         {activeTab === 'editor' && <EditorTab />}
         {activeTab === 'captions' && <CaptionTab />}
         {activeTab === 'publish' && <PublishTab />}
      </main>
    </div>
  );
};

export default App;