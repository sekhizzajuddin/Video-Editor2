// ─────────────────────────────────────────────────────────────────────────────
// [DESKTOP SYNC] Mobile feature — it has a DESKTOP counterpart.
// Rule: if an update changes LOGIC, changes ARCHITECTURE, or FIXES A BUG, apply
// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/components/WelcomeScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Plus, Clapperboard, FolderOpen } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { listRecentProjects, setActiveProject, saveProjectMeta, type ProjectMetadata } from '@/utils/projectPersistence';

export function MobileWelcomeScreen({ onImport }: { onImport: () => void }) {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const { resetProject, setProjectInfo, loadProject } = useEditorStore();

  useEffect(() => {
    listRecentProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  const generateDefaultName = () =>
    `Project - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;

  const createProject = async (name?: string) => {
    const finalName = name?.trim() || generateDefaultName();
    const newId = crypto.randomUUID();
    await resetProject(false);
    setProjectInfo(newId, finalName);
    setActiveProject(newId);
    await saveProjectMeta({ id: newId, name: finalName, lastModified: Date.now() });
  };

  const openProject = async (id: string, name: string) => {
    await resetProject(false);
    setProjectInfo(id, name);
    setActiveProject(id);
    await loadProject();
  };

  return (
    <div className="mobile-no-scrollbar absolute inset-0 z-50 flex flex-col overflow-y-auto bg-[#0c0c10] px-6 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-900/40">
            <Clapperboard className="h-8 w-8 text-black" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">ProCut</h1>
          <p className="text-[12px] text-white/40">Mobile video editor</p>
        </div>

        <button
          onClick={() => createProject()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-[15px] font-bold text-black shadow-lg shadow-amber-900/30 active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          New Project
        </button>
        <button
          onClick={() => { createProject(); onImport(); }}
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4 text-[15px] font-semibold text-white active:bg-white/10"
        >
          <FolderOpen className="h-5 w-5 text-amber-400" />
          Import Media
        </button>

        {projects.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Recent projects</p>
            <div className="space-y-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProject(p.id, p.name)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white/60">
                    <Clapperboard className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-white">{p.name}</span>
                    <span className="block text-[10px] text-white/40">
                      {new Date(p.lastModified).toLocaleString()}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
