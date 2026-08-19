// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/App.tsx (DesktopApp)
// Preview/Export/Settings/Help/AspectRatio modals are REUSED from desktop (no mobile copy).
// ─────────────────────────────────────────────────────────────────────────────

import React, { Suspense, useEffect, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { FileHandlerInitializer } from '@/components/FileHandlerInitializer';
import { Toaster } from '@/components/ui/sonner';
import { MobileTopBar } from './components/MobileTopBar';
import { MobileTimeline } from './components/MobileTimeline';
import { MobileToolRail } from './components/MobileToolRail';
import { MobileMediaSheet, MobileMediaTab } from './components/MobileMediaSheet';
import { PropertiesPanel } from '@/components/properties/PropertiesPanel';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import { MobileWelcomeScreen } from './components/MobileWelcomeScreen';
import { PwaStatusListener } from './components/PwaStatusListener';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { addTextClipToTimeline } from './lib/timeline';
import './mobile.css';

const PreviewCanvas = React.lazy(() => import('@/components/PreviewCanvas').then((m) => ({ default: m.PreviewCanvas })));
const ExportModal = React.lazy(() => import('@/components/ExportModal').then((m) => ({ default: m.ExportModal })));
const SettingsModal = React.lazy(() => import('@/components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const AspectRatioConflictModal = React.lazy(() => import('@/components/AspectRatioConflictModal').then((m) => ({ default: m.AspectRatioConflictModal })));
const HelpModal = React.lazy(() => import('@/components/HelpModal').then((m) => ({ default: m.HelpModal })));

type Sheet = 'none' | 'media' | 'properties';

export function MobileApp() {
  const { projectId, showExportModal, showSettingsModal, selectedClipId } = useEditorStore(
    useShallow((s) => ({
      projectId: s.projectId,
      showExportModal: s.showExportModal,
      showSettingsModal: s.showSettingsModal,
      selectedClipId: s.selectedClipId,
    }))
  );

  const [sheet, setSheet] = useState<Sheet>('none');
  const [mediaInitialTab, setMediaInitialTab] = useState<MobileMediaTab>('media');
  const online = useOnlineStatus();

  // Property sheet is only opened on explicit tab click in MobileToolRail
  const [activePropertyTab, setActivePropertyTab] = useState<string | undefined>();

  const openMedia = (tab: MobileMediaTab = 'media') => {
    setMediaInitialTab(tab);
    setSheet('media');
  };

  return (
    <div className="mobile-app relative flex h-full w-full flex-col overflow-hidden bg-[#0c0c10] text-white">
      {projectId === 'default' ? (
        <MobileWelcomeScreen onImport={() => openMedia('media')} />
      ) : (
        <>
          <MobileTopBar />

          {/* Offline indicator — the app keeps working, saved locally. */}
          {!online && (
            <div className="flex shrink-0 items-center justify-center gap-1.5 bg-amber-500/90 px-2 py-1 text-[11px] font-semibold text-black">
              <span className="inline-block h-2 w-2 rounded-full bg-black" />
              Offline — edits are saved on this device
            </div>
          )}

          {/* Preview (reuses the desktop render engine + transform overlay) */}
          <div className="mobile-preview min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<div className="h-full w-full bg-[#0a0a0a]" />}>
              <PreviewCanvas />
            </Suspense>
          </div>

          {/* Timeline */}
          <div className="h-[230px] shrink-0 border-t border-white/10">
            <MobileTimeline onSelectClip={() => {}} onOpenTransitions={() => openMedia('transitions')} />
          </div>

          {/* Tool rail */}
          <MobileToolRail
            onAddMedia={() => openMedia('media')}
            onAddTransition={() => openMedia('transitions')}
            onAddTemplate={() => openMedia('templates')}
            onOpenAiVoice={() => openMedia('audio')}
            onAddPip={() => openMedia('media')}
            onAddText={() => {
              addTextClipToTimeline('Your Text');
              setActivePropertyTab('text');
              setSheet('properties');
            }}
            onAddAudio={() => openMedia('audio')}
            onAddEffect={() => openMedia('effects')}
            onOpenProperties={(tab) => {
              if (tab) setActivePropertyTab(tab);
              setSheet('properties');
            }}
          />
        </>
      )}

      {/* Bottom sheets */}
      <MobileBottomSheet
        open={sheet === 'media'}
        onClose={() => setSheet('none')}
        title="Add to project"
      >
        <MobileMediaSheet initialTab={mediaInitialTab} onClose={() => setSheet('none')} />
      </MobileBottomSheet>

      <MobileBottomSheet
        open={sheet === 'properties'}
        onClose={() => setSheet('none')}
        height="65%"
      >
        <PropertiesPanel isMobileView={true} mobileCategory={activePropertyTab as any} onMobileClose={() => setSheet('none')} />
      </MobileBottomSheet>

      {/* Global handlers & modals (reused from desktop) */}
      <FileHandlerInitializer />
      <Suspense fallback={null}>
        <AspectRatioConflictModal />
      </Suspense>
      {showExportModal && (
        <Suspense fallback={null}>
          <ExportModal />
        </Suspense>
      )}
      {showSettingsModal && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <HelpModal />
      </Suspense>
      <PwaStatusListener />
      <Toaster />
    </div>
  );
}

export default MobileApp;
