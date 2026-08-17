import React, { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { listRecentProjects, ProjectMetadata, setActiveProject, deleteProjectMeta, saveProjectMeta } from '@/utils/projectPersistence';
import { getProcutFilesInDirectory } from '@/utils/fileSystemAccess';

export const WelcomeScreen: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [crashedProjects, setCrashedProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceSelected, setWorkspaceSelected] = useState(false);
  
  // Create New Project State
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const { resetProject, setProjectInfo, loadProject } = useEditorStore();

  useEffect(() => {
    loadCrashedProjects();
  }, []);

  const loadCrashedProjects = async () => {
    setLoading(true);
    try {
      const list = await listRecentProjects();
      setCrashedProjects(list);
    } catch (err) {
      console.error('Failed to load crashed projects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkspace = async () => {
    try {
      setLoading(true);
      const list = await getProcutFilesInDirectory();
      setProjects(list);
      setWorkspaceSelected(true);
    } catch (err) {
      console.error('Failed to load workspace folder', err);
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
    await resetProject(false);
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
    await resetProject(false);
    setProjectInfo(id, name);
    setActiveProject(id);
    await loadProject();
  };

  const handleOpenProcutFile = async (project: any) => {
    await resetProject(false);
    const { loadProjectData } = await import('@/utils/fileSystemAccess');
    loadProjectData(project.data);
    
    // Set project info AFTER loadProjectData so that older JSON files without a projectId
    // don't overwrite it back to 'default', which would prevent the Welcome Screen from closing.
    setProjectInfo(project.id, project.name);
    useEditorStore.setState({ projectFileHandle: project.handle });
    setActiveProject(project.id);
    
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Project loaded! Please re-import local media files to relink them.', type: 'success' }}));
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this recovered project permanently?')) {
      await deleteProjectMeta(id);
      await loadCrashedProjects();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1a1a1a] z-50 flex flex-col items-center justify-center p-8 text-white">
      <div className="w-full max-w-4xl bg-[#2d2d2d] rounded-xl shadow-2xl p-8 flex flex-col gap-8 h-[80vh]">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600">ProCut Studio</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 overflow-hidden">
          {/* New Project Column */}
          <div className="flex flex-col gap-4 border-r border-[#3e3e3e] pr-8">
            <h2 className="text-xl font-semibold mb-4 text-[#e0e0e0]">Start a New Project</h2>
            
            {isCreating ? (
              <form onSubmit={handleCreateNewProject} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="projectName" className="text-sm text-[#a0a0a0]">Project Name</label>
                  <input
                    id="projectName"
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder={generateDefaultName()}
                    className="bg-[#3e3e3e] border border-[#4a4a4a] rounded p-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded font-medium transition-colors"
                  >
                    Create
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 bg-[#3e3e3e] hover:bg-[#4a4a4a] text-white py-3 rounded font-medium transition-colors"
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
                className="group flex flex-col items-center justify-center gap-4 bg-[#3e3e3e]/50 hover:bg-[#3e3e3e] border-2 border-dashed border-[#4a4a4a] hover:border-amber-500 rounded-xl p-12 transition-all cursor-pointer h-64"
              >
                <div className="w-16 h-16 rounded-full bg-amber-600/20 group-hover:bg-amber-600/40 flex items-center justify-center transition-colors">
                  <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-lg font-medium text-[#e0e0e0] group-hover:text-white">Create New Project</span>
              </button>
            )}
          </div>

          {/* Load Workspace Column */}
          <div className="flex flex-col overflow-hidden pl-4">
            <h2 className="text-xl font-semibold mb-4 text-[#e0e0e0]">Open Workspace Folder</h2>
            
            {!workspaceSelected ? (
              <div className="flex flex-col items-center justify-center flex-1">
                <button 
                  onClick={handleSelectWorkspace}
                  className="group flex flex-col items-center justify-center gap-4 bg-[#3e3e3e]/50 hover:bg-[#3e3e3e] border-2 border-dashed border-[#4a4a4a] hover:border-amber-500 rounded-xl p-8 w-full max-w-sm transition-all cursor-pointer h-48"
                >
                  <div className="w-16 h-16 rounded-full bg-amber-600/20 group-hover:bg-amber-600/40 flex items-center justify-center transition-colors">
                    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-lg font-medium text-[#e0e0e0] group-hover:text-white">Select Workspace Folder</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-amber-500 font-medium">Found {projects.length} project(s)</span>
                  <button onClick={handleSelectWorkspace} className="text-xs text-[#a0a0a0] hover:text-white underline">Change Folder</button>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center flex-1">
                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-[#a0a0a0] gap-2">
                    <svg className="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p>No .procut files found in folder</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-4">
                    {projects.map(project => (
                      <div 
                        key={project.id}
                        onClick={() => handleOpenProcutFile(project)}
                        className="group flex items-center justify-between bg-[#3e3e3e]/30 hover:bg-[#3e3e3e] border border-[#4a4a4a]/50 hover:border-amber-500/50 p-4 rounded-lg cursor-pointer transition-all"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-[#f0f0f0] group-hover:text-white truncate max-w-[200px]" title={project.name}>
                            {project.name}
                          </span>
                          <span className="text-xs text-[#a0a0a0]">
                            Last modified: {new Date(project.lastModified).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Crashed Projects Recovery */}
            {crashedProjects.length > 0 && (
              <div className="mt-6 border-t border-[#3e3e3e] pt-4">
                <h3 className="text-sm font-semibold mb-3 text-red-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Recover Crashed Projects
                </h3>
                <div className="max-h-32 overflow-y-auto pr-2 space-y-2">
                  {crashedProjects.map(project => (
                    <div 
                      key={project.id}
                      onClick={() => handleOpenProject(project.id, project.name)}
                      className="group flex items-center justify-between bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 p-2 rounded cursor-pointer transition-all"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-red-200 truncate max-w-[150px]">{project.name}</span>
                        <span className="text-[10px] text-red-400/70">{new Date(project.lastModified).toLocaleString()}</span>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-200 hover:bg-red-900/50 rounded transition-all"
                        title="Delete Recovery Data"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
