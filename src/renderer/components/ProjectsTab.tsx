
import React, { useState, useEffect } from 'react';
import { Folder, Plus, Trash2, Video, FileText, ChevronRight, MoreVertical, Sparkles, Loader2, Play } from 'lucide-react';
import { ProjectDetail } from './ProjectDetail';
import { api, runAutoProcess, getJobStatus } from '../api';

interface Project {
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    path: string;
    videos?: any[];
}

interface ProjectsTabProps {
    onOpenEditor: (clips: any[]) => void;
}

export const ProjectsTab = ({ onOpenEditor }: ProjectsTabProps) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [showAutoModal, setShowAutoModal] = useState(false);
    const [autoKeyword, setAutoKeyword] = useState('trending indonesia');
    const [autoCount, setAutoCount] = useState(3);
    const [autoPlatform, setAutoPlatform] = useState('youtube');
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    const [autoJobId, setAutoJobId] = useState<string | null>(null);
    const [autoProgress, setAutoProgress] = useState(0);
    const [autoLogs, setAutoLogs] = useState<string>('');

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects');
            // Handle both direct array and { projects: [] } formats
            const data = Array.isArray(res.data) ? res.data : (res.data?.projects || []);
            setProjects(data);
        } catch (error) {
            console.error('Failed to fetch projects:', error);
            setProjects([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleCreateProject = async () => {
        if (!newProjectName) return;
        try {
            const res = await api.post('/projects', { name: newProjectName, description: newProjectDesc });
            setProjects([res.data, ...projects]);
            setShowCreateModal(false);
            setNewProjectName('');
            setNewProjectDesc('');
        } catch (error) {
            console.error('Failed to create project:', error);
        }
    };

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure? This will delete the project structure.')) return;
        try {
            await api.delete(`/projects/${id}`);
            setProjects(projects.filter(p => p.id !== id));
            if (selectedProject?.id === id) setSelectedProject(null);
        } catch (error) {
            console.error('Failed to delete project:', error);
        }
    };

    const handleRunAuto = async () => {
        setIsAutoRunning(true);
        setAutoProgress(0);
        setAutoLogs('Initializing automated workflow...');
        try {
            // Create a project for this auto run if needed, or just run globally.
            // Let's create a project automatically.
            const projectRes = await api.post('/projects', {
                name: `Auto: ${autoKeyword}`,
                description: `Automated processing for ${autoKeyword} at ${new Date().toLocaleString()}`
            });
            const projectId = projectRes.data.id;

            const res = await runAutoProcess({
                keyword: autoKeyword,
                count: autoCount,
                platform: autoPlatform,
                projectId
            });
            setAutoJobId(res.jobId);
        } catch (error) {
            console.error('Failed to run auto clipper:', error);
            alert('Failed to start auto clipper');
            setIsAutoRunning(false);
        }
    };

    useEffect(() => {
        if (!autoJobId) return;

        const interval = setInterval(async () => {
            try {
                const status = await getJobStatus('auto', autoJobId);
                setAutoProgress(status.progress || 0);

                if (status.data && status.data.logs) {
                    setAutoLogs(status.data.logs);
                }

                if (status.state === 'completed' || status.state === 'failed') {
                    setAutoJobId(null);
                    setIsAutoRunning(false);
                    setShowAutoModal(false);
                    fetchProjects(); // Refresh projects to show the new one
                    if (status.state === 'completed') {
                        alert('Auto Clipper completed successfully!');
                    } else {
                        alert('Auto Clipper failed.');
                    }
                }
            } catch (e) {
                console.error("Error polling auto job:", e);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [autoJobId]);

    if (selectedProject) {
        return <ProjectDetail project={selectedProject} onBack={() => {
            setSelectedProject(null);
            fetchProjects(); // Refresh list on back
        }} onOpenEditor={onOpenEditor} />;
    }

    return (
        <div className="flex flex-col h-full bg-slate-900/50 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100">Projects</h2>
                    <p className="text-slate-400">Manage your film recap projects</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAutoModal(true)}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition"
                    >
                        <Sparkles size={18} /> Auto Clipper (AI)
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
                    >
                        <Plus size={18} /> New Project
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center text-slate-500 mt-10">Loading projects...</div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-700 rounded-xl">
                    <Folder size={48} className="text-slate-600 mb-4" />
                    <p className="text-slate-400">No projects yet. Create one to get started!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <div
                            key={project.id}
                            onClick={() => setSelectedProject(project)}
                            className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                                    <Folder size={24} />
                                </div>
                                <button
                                    onClick={(e) => handleDeleteProject(project.id, e)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <h3 className="text-lg font-semibold text-slate-100 mb-2">{project.name}</h3>
                            <p className="text-slate-400 text-sm mb-4 line-clamp-2">{project.description || 'No description'}</p>

                            <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-700 pt-4">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <Video size={14} /> 0 Videos
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <FileText size={14} /> 0 Scripts
                                    </span>
                                </div>
                                <span className="flex items-center gap-1 text-indigo-400 group-hover:translate-x-1 transition-transform">
                                    Open <ChevronRight size={14} />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Create New Project</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Project Name</label>
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="e.g. Inception Recap"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                                <textarea
                                    value={newProjectDesc}
                                    onChange={(e) => setNewProjectDesc(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 h-24 resize-none"
                                    placeholder="Brief description of the project..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateProject}
                                disabled={!newProjectName}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
                            >
                                Create Project
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Auto Clipper Modal */}
            {showAutoModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                                <Sparkles size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Magic AI Auto Clipper</h3>
                        </div>

                        <p className="text-slate-400 text-sm mb-6">
                            Enter a keyword to find viral content. AI will automatically search, download, find highlights, create clips, and generate metadata.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Search Keyword (Target Indonesia)</label>
                                <input
                                    type="text"
                                    value={autoKeyword}
                                    onChange={(e) => setAutoKeyword(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="e.g. masak viral, lucu banget, trending indonesia"
                                    disabled={isAutoRunning}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Platform</label>
                                    <select
                                        value={autoPlatform}
                                        onChange={(e) => setAutoPlatform(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                        disabled={isAutoRunning}
                                    >
                                        <option value="youtube">YouTube</option>
                                        <option value="tiktok">TikTok (Search)</option>
                                        <option value="instagram">Instagram (Search)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Video Count</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={autoCount}
                                        onChange={(e) => setAutoCount(parseInt(e.target.value))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                        disabled={isAutoRunning}
                                    />
                                </div>
                            </div>

                            {isAutoRunning && (
                                <div className="pt-4">
                                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                                        <span>AI is processing your request...</span>
                                        <span>{autoProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-2">
                                        <div
                                            className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${autoProgress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 italic text-center">
                                        This involves searching, downloading, transcribing, and clipping. It may take a few minutes.
                                    </p>
                                </div>
                            )}

                            {(isAutoRunning || autoLogs) && (
                                <div className="mt-4">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Process Details</label>
                                    <div className="bg-black/50 border border-slate-700 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[10px] text-emerald-400 whitespace-pre-wrap">
                                        {autoLogs || 'Waiting for output...'}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            {!isAutoRunning && (
                                <button
                                    onClick={() => setShowAutoModal(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleRunAuto}
                                disabled={!autoKeyword || isAutoRunning}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition flex items-center gap-2"
                            >
                                {isAutoRunning ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" /> Processing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} /> Start Auto Process
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
