import React, { useEffect, useState } from 'react';
import { X, FolderOpen, Trash2, Clock } from 'lucide-react';
import { listRecentProjects, deleteProjectMeta, setActiveProject } from '@/utils/projectPersistence';
import { useEditorStore } from '@/store/editorStore';
import { toast } from 'sonner';

interface RecentProject {
  id: string;
  name: string;
  lastModified: number;
  clipCount?: number;
}

interface RecentProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (projectId: string) => void;
}

export function RecentProjectsModal({ isOpen, onClose, onSelect }: RecentProjectsModalProps) {
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    listRecentProjects()
      .then((list) => {
        const mapped = list.map((p) => ({
          id: p.id,
          name: p.name || 'Untitled Project',
          lastModified: p.lastModified,
        }));
        mapped.sort((a, b) => b.lastModified - a.lastModified);
        setProjects(mapped);
      })
      .catch((err) => {
        console.error('Failed to list projects:', err);
        toast.error('Failed to load recent projects');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpen = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const state = useEditorStore.getState();
    await state.resetProject(false);
    state.setProjectInfo(projectId, project?.name || 'Untitled');
    setActiveProject(projectId);
    await state.loadProject();
    toast.success(`Opened: ${project?.name || 'Project'}`);
    onSelect(projectId);
    onClose();
  };

  const handleDelete = (projectId: string, name: string) => {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    deleteProjectMeta(projectId).then(() => {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success('Project deleted');
    });
  };

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
      <div className="bg-[#2d2d2d] rounded-lg shadow-2xl w-[480px] max-h-[80vh] overflow-hidden border border-[#3e3e3e] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#3e3e3e]">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Recent Projects</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#a0a0a0] hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="text-center py-8 text-xs text-[#6a6a6a]">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#6a6a6a]">
              No recent projects found.
            </div>
          ) : (
            projects.map((proj) => (
              <div
                key={proj.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded hover:bg-[#3e3e3e] transition-colors group"
              >
                <button
                  onClick={() => handleOpen(proj.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-xs text-white font-medium truncate">{proj.name}</div>
                  <div className="text-[10px] text-[#6a6a6a]">{formatTime(proj.lastModified)}</div>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpen(proj.id)}
                    className="p-1 text-amber-400 hover:bg-amber-500/15 rounded transition-colors"
                    title="Open project"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(proj.id, proj.name)}
                    className="p-1 text-red-400 hover:bg-red-500/15 rounded transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
