// ─────────────────────────────────────────────────────────────────────────────
// [MOBILE SYNC] Desktop feature — it has a MOBILE counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the mobile file(s) below. SKIP if the update is UI-only.
// Mobile counterpart:
//   src/mobile/components/MobileWelcomeScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { listRecentProjects, ProjectMetadata, setActiveProject, deleteProjectMeta, saveProjectMeta } from '@/utils/projectPersistence';
import { getProcutFilesInDirectory } from '@/utils/fileSystemAccess';
import { ProCutLogo } from '@/components/ProCutLogo';
import { Plus, FolderOpen, AlertTriangle, Trash2, Folder, Clock, Sparkles } from 'lucide-react';

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
    return `Project - ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-[var(--theme-text-primary)] select-none">
      <div className="w-full max-w-4xl bg-[var(--theme-bg-panel)] rounded-2xl shadow-2xl border border-[var(--theme-border)] p-8 flex flex-col gap-6 max-h-[85vh] overflow-hidden">
        {/* Header with ProCut Wordmark */}
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-5">
          <div className="flex items-center gap-3">
            <ProCutLogo size="lg" />
            <div className="h-6 w-px bg-[var(--theme-border)] mx-1" />
            <span className="text-xs font-semibold text-[var(--theme-text-muted)] tracking-wider uppercase">Studio</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--theme-text-muted)]">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>AI-Powered Non-Linear Video Editor</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden min-h-0">
          {/* New Project Column */}
          <div className="flex flex-col gap-4 border-r border-[var(--theme-border)] pr-6 overflow-y-auto scrollbar-thin">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">Start a New Project</h2>
            
            {isCreating ? (
              <form onSubmit={handleCreateNewProject} className="flex flex-col gap-4 bg-[var(--theme-bg-subpanel)] p-5 rounded-xl border border-[var(--theme-border)]">
                <div className="flex flex-col gap-2">
                  <label htmlFor="projectName" className="text-xs font-semibold text-[var(--theme-text-primary)]">Project Name</label>
                  <input
                    id="projectName"
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder={generateDefaultName()}
                    className="bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-lg p-2.5 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-blue-500 transition-colors shadow-sm"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2.5 mt-2">
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-semibold text-xs transition-colors shadow-sm"
                  >
                    Create Project
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] text-[var(--theme-text-primary)] py-2.5 rounded-lg font-medium text-xs transition-colors"
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
                className="group flex flex-col items-center justify-center gap-3.5 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-card)] border-2 border-dashed border-[var(--theme-border)] hover:border-blue-500/60 rounded-2xl p-8 transition-all cursor-pointer h-52 shadow-sm"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 group-hover:scale-105 flex items-center justify-center transition-all border border-blue-500/20 shadow-sm">
                  <Plus className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-[var(--theme-text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Create New Project</span>
                  <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">Start fresh timeline with multi-track support</p>
                </div>
              </button>
            )}
          </div>

          {/* Load Workspace Column */}
          <div className="flex flex-col overflow-hidden pl-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--theme-text-muted)] mb-3">Open Workspace Folder</h2>
            
            {!workspaceSelected ? (
              <div className="flex flex-col items-center justify-center flex-1">
                <button 
                  onClick={handleSelectWorkspace}
                  className="group flex flex-col items-center justify-center gap-3.5 bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-card)] border-2 border-dashed border-[var(--theme-border)] hover:border-purple-500/60 rounded-2xl p-8 w-full transition-all cursor-pointer h-52 shadow-sm"
                >
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 group-hover:bg-purple-500/20 group-hover:scale-105 flex items-center justify-center transition-all border border-purple-500/20 shadow-sm">
                    <FolderOpen className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-[var(--theme-text-primary)] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Select Workspace Folder</span>
                    <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">Load existing .procut project files from disk</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Found ${projects.length} project(s)</span>
                  <button onClick={handleSelectWorkspace} className="text-xs text-[var(--theme-text-muted)] hover:text-blue-500 underline">Change Folder</button>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center flex-1">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-[var(--theme-text-muted)] gap-2">
                    <Folder className="w-10 h-10 opacity-30" />
                    <p className="text-xs">No .procut files found in folder</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 pb-2 scrollbar-thin">
                    {projects.map(project => (
                      <div 
                        key={project.id}
                        onClick={() => handleOpenProcutFile(project)}
                        className="group flex items-center justify-between bg-[var(--theme-bg-subpanel)] hover:bg-[var(--theme-bg-card)] border border-[var(--theme-border)] hover:border-blue-500/50 p-3 rounded-xl cursor-pointer transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                            <Folder className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-xs text-[var(--theme-text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate" title={project.name}>
                              ${project.name}
                            </span>
                            <span className="text-[10px] text-[var(--theme-text-muted)] flex items-center gap-1 mt-0.5 font-mono">
                              <Clock className="w-3 h-3" />
                              ${new Date(project.lastModified).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Crashed Projects Recovery */}
            {crashedProjects.length > 0 && (
              <div className="mt-4 border-t border-[var(--theme-border)] pt-3.5">
                <h3 className="text-xs font-bold mb-2 text-rose-500 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Recover Crashed Projects</span>
                </h3>
                <div className="max-h-28 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                  {crashedProjects.map(project => (
                    <div 
                      key={project.id}
                      onClick={() => handleOpenProject(project.id, project.name)}
                      className="group flex items-center justify-between bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 p-2 rounded-lg cursor-pointer transition-all"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-300 truncate">${project.name}</span>
                        <span className="text-[9px] text-rose-500/70 font-mono">${new Date(project.lastModified).toLocaleString()}</span>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-500/20 rounded transition-all"
                        title="Delete Recovery Data"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
