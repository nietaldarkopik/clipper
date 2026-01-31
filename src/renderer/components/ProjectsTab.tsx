
import React, { useState, useEffect } from 'react';
import { Folder, Plus, Trash2, Video, FileText, ChevronRight, MoreVertical } from 'lucide-react';
import { ProjectDetail } from './ProjectDetail';

interface Project {
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    path: string;
    videos?: any[];
}

export const ProjectsTab = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    const fetchProjects = async () => {
        try {
            const res = await fetch('http://localhost:3000/projects');
            const data = await res.json();
            setProjects(data);
        } catch (error) {
            console.error('Failed to fetch projects:', error);
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
            const res = await fetch('http://localhost:3000/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProjectName, description: newProjectDesc })
            });
            const project = await res.json();
            setProjects([project, ...projects]);
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
            await fetch(`http://localhost:3000/projects/${id}`, { method: 'DELETE' });
            setProjects(projects.filter(p => p.id !== id));
            if (selectedProject?.id === id) setSelectedProject(null);
        } catch (error) {
            console.error('Failed to delete project:', error);
        }
    };

    if (selectedProject) {
        return <ProjectDetail project={selectedProject} onBack={() => {
            setSelectedProject(null);
            fetchProjects(); // Refresh list on back
        }} />;
    }

    return (
        <div className="flex flex-col h-full bg-slate-900/50 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100">Projects</h2>
                    <p className="text-slate-400">Manage your film recap projects</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
                >
                    <Plus size={18} /> New Project
                </button>
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
        </div>
    );
};
