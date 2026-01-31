import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { getSettings, updateSettings, setApiBaseUrl } from '../api';

export const SettingsTab = () => {
    const [settings, setSettings] = useState<any>({
        aiProvider: 'openai',
        openaiApiKey: '',
        ollamaUrl: 'http://localhost:11434',
        backendUrl: 'http://localhost:3000',
        transcriptionMethod: 'auto',
        whisperModel: 'tiny',
        language: 'en'
    });
    const [apiUrl, setApiUrl] = useState(localStorage.getItem('VITE_API_URL') || import.meta.env.VITE_API_URL || '');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const data = await getSettings();
            setSettings(data);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            setMessage({ type: 'error', text: 'Gagal memuat pengaturan. Pastikan backend berjalan.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            // Update API URL locally
            setApiBaseUrl(apiUrl);
            
            // Save other settings to backend
            const updated = await updateSettings(settings);
            setSettings(updated);
            
            setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan!' });
            
            // Auto hide success message
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage({ type: 'error', text: 'Gagal menyimpan pengaturan.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center text-slate-500">
            <RefreshCw className="animate-spin mr-2" /> Memuat Pengaturan...
        </div>;
    }

    return (
        <div className="flex-1 flex flex-col overflow-y-auto bg-[#0f0f0f] p-8">
            <div className="max-w-4xl mx-auto w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Settings className="text-indigo-500" /> Pengaturan Sistem
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Konfigurasi AI, Transkripsi, dan Backend.</p>
                    </div>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                    >
                        {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
                        message.type === 'success' 
                            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                        {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                        <span className="text-sm font-medium">{message.text}</span>
                    </div>
                )}

                <div className="space-y-6">
                    {/* AI Provider Section */}
                    <section className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
                        <h3 className="text-lg font-bold text-white mb-4">AI Provider (Generative Text)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Provider</label>
                                <select 
                                    value={settings.aiProvider}
                                    onChange={(e) => setSettings({...settings, aiProvider: e.target.value})}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                                >
                                    <option value="openai">OpenAI (GPT-3.5/4)</option>
                                    <option value="ollama">Ollama (Local LLM)</option>
                                </select>
                            </div>

                            {settings.aiProvider === 'openai' ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">OpenAI API Key</label>
                                    <input 
                                        type="password"
                                        placeholder="sk-..."
                                        value={settings.openaiApiKey}
                                        onChange={(e) => setSettings({...settings, openaiApiKey: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Ollama URL</label>
                                    <input 
                                        type="text"
                                        placeholder="http://localhost:11434"
                                        value={settings.ollamaUrl}
                                        onChange={(e) => setSettings({...settings, ollamaUrl: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                                    />
                                    <p className="text-[10px] text-slate-500">Contoh: http://prof.unwim.ac.id/ai/chat</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Transcription Section */}
                    <section className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
                        <h3 className="text-lg font-bold text-white mb-4">Transkripsi Audio</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Metode Transkripsi</label>
                                <select 
                                    value={settings.transcriptionMethod}
                                    onChange={(e) => setSettings({...settings, transcriptionMethod: e.target.value})}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                                >
                                    <option value="auto">Otomatis (Prioritas Youtube Subtitle)</option>
                                    <option value="youtube">Youtube Transcript Saja</option>
                                    <option value="whisper">Whisper Local (Paksa)</option>
                                </select>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Whisper Model Size</label>
                                <select 
                                    value={settings.whisperModel}
                                    onChange={(e) => setSettings({...settings, whisperModel: e.target.value})}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                                    disabled={settings.transcriptionMethod === 'youtube'}
                                >
                                    <option value="tiny">Tiny (Tercepat, Akurasi Rendah)</option>
                                    <option value="base">Base (Seimbang)</option>
                                    <option value="small">Small (Akurasi Baik)</option>
                                    <option value="medium">Medium (Lambat, Akurasi Tinggi)</option>
                                    <option value="large">Large (Sangat Lambat, Terbaik)</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Backend Config */}
                    <section className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
                        <h3 className="text-lg font-bold text-white mb-4">Koneksi Backend</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Vite API URL (Frontend)</label>
                                <input 
                                    type="text"
                                    value={apiUrl}
                                    onChange={(e) => setApiUrl(e.target.value)}
                                    placeholder="http://localhost:3000"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                                />
                                <p className="text-[10px] text-slate-600">Alamat backend API yang diakses oleh frontend ini.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Backend Service URL</label>
                                <input 
                                    type="text"
                                    value={settings.backendUrl}
                                    onChange={(e) => setSettings({...settings, backendUrl: e.target.value})}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
