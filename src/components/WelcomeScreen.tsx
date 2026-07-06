import React, { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { listRecentProjects, ProjectMetadata, setActiveProject, deleteProjectMeta, saveProjectMeta } from '@/utils/projectPersistence';

export const WelcomeScreen: React.FC = () => {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create New Project State
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const { resetProject, setProjectInfo, loadProject } = useEditorStore();

  useEffect(() => {
    loadRecentProjects();
  }, []);

  const loadRecentProjects = async () => {
    setLoading(true);
    try {
      const list = await listRecentProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load recent projects', err);
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultName = () => {
    const date = new Date();
    return `Project - ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = newProjectName.trim() || generateDefaultName();
    const newId = crypto.randomUUID();
    
    // Set up the store for a completely new project
    resetProject();
    setProjectInfo(newId, finalName);
    setActiveProject(newId);
    
    // Save to global list immediately so it shows up in Recent Projects even if empty
    await saveProjectMeta({
      id: newId,
      name: finalName,
      lastModified: Date.now()
    });
  };

  const handleOpenProject = async (id: string, name: string) => {
    // Reset to clear previous tracks/media to prevent flashing old content
    resetProject();
    setProjectInfo(id, name);
    setActiveProject(id);
    
    // The App.tsx normally loads project on mount, but since we are dynamically switching:
    await loadProject();
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project permanently?')) {
      await deleteProjectMeta(id);
      await loadRecentProjects();
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-900 z-50 flex flex-col items-center justify-center p-8 text-white">
      <div className="w-full max-w-4xl bg-surface-800 rounded-xl shadow-2xl p-8 flex flex-col gap-8 h-[80vh]">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-primary-600">ProCut Studio</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 overflow-hidden">
          {/* New Project Column */}
          <div className="flex flex-col gap-4 border-r border-surface-700 pr-8">
            <h2 className="text-xl font-semibold mb-4 text-surface-200">Start a New Project</h2>
            
            {isCreating ? (
              <form onSubmit={handleCreateNewProject} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="projectName" className="text-sm text-surface-400">Project Name</label>
                  <input
                    id="projectName"
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder={generateDefaultName()}
                    className="bg-surface-700 border border-surface-600 rounded p-3 text-white focus:outline-none focus:border-primary-500 transition-colors"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-3 rounded font-medium transition-colors"
                  >
                    Create
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 bg-surface-700 hover:bg-surface-600 text-white py-3 rounded font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button 
                onClick={() => {
                  setNewProjectName(generateDefaultName());
                  setIsCreating(true);
                }}
                className="group flex flex-col items-center justify-center gap-4 bg-surface-700/50 hover:bg-surface-700 border-2 border-dashed border-surface-600 hover:border-primary-500 rounded-xl p-12 transition-all cursor-pointer h-64"
              >
                <div className="w-16 h-16 rounded-full bg-primary-600/20 group-hover:bg-primary-600/40 flex items-center justify-center transition-colors">
                  <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-lg font-medium text-surface-200 group-hover:text-white">Create New Project</span>
              </button>
            )}
          </div>

          {/* Recent Projects Column */}
          <div className="flex flex-col overflow-hidden pl-4">
            <h2 className="text-xl font-semibold mb-4 text-surface-200">Recent Projects</h2>
            
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-surface-400 gap-2">
                <svg className="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p>No recent projects found</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-4">
                {projects.map(project => (
                  <div 
                    key={project.id}
                    onClick={() => handleOpenProject(project.id, project.name)}
                    className="group flex items-center justify-between bg-surface-700/30 hover:bg-surface-700 border border-surface-600/50 hover:border-surface-500 p-4 rounded-lg cursor-pointer transition-all"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-surface-100 group-hover:text-white truncate max-w-[200px]" title={project.name}>
                        {project.name}
                      </span>
                      <span className="text-xs text-surface-400">
                        Last opened: {new Date(project.lastModified).toLocaleString()}
                      </span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-surface-400 hover:text-red-400 hover:bg-surface-600 rounded transition-all"
                      title="Delete Project"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
