// the same change to the desktop file(s) below. SKIP if the update is UI-only.
// Desktop counterpart:
//   src/App.tsx (DesktopApp)
// Preview/Export/Settings/Help/AspectRatio modals are REUSED from desktop (no mobile copy).
// ─────────────────────────────────────────────────────────────────────────────

import React, { Suspense, useEffect, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { FileHandlerInitializer } from '@/components/FileHandlerInitializer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
import { ExportModal } from '@/components/ExportModal';
const SettingsModal = React.lazy(() => import('@/components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const AspectRatioConflictModal = React.lazy(() => import('@/components/AspectRatioConflictModal').then((m) => ({ default: m.AspectRatioConflictModal })));
const HelpModal = React.lazy(() => import('@/components/HelpModal').then((m) => ({ default: m.HelpModal })));
const AiSpeedSyncModal = React.lazy(() => import('@/components/AiSpeedSyncModal').then((m) => ({ default: m.AiSpeedSyncModal })));
const CustomFxMakerModal = React.lazy(() => import('@/components/CustomFxMakerModal').then((m) => ({ default: m.CustomFxMakerModal })));
const AutoDuckingModal = React.lazy(() => import('@/components/AutoDuckingModal').then((m) => ({ default: m.AutoDuckingModal })));

type Sheet = 'none' | 'media' | 'properties';

export function MobileApp() {
  const { projectId, showExportModal, showSettingsModal, showAiSpeedSyncModal, setShowAiSpeedSyncModal, showAutoDuckingModal, setShowAutoDuckingModal, showCustomFxMakerModal, closeCustomFxMaker, selectedClipId } = useEditorStore(
    useShallow((s) => ({
      projectId: s.projectId,
      showExportModal: s.showExportModal,
      showSettingsModal: s.showSettingsModal,
      showAiSpeedSyncModal: s.showAiSpeedSyncModal,
      setShowAiSpeedSyncModal: s.setShowAiSpeedSyncModal,
      showAutoDuckingModal: s.showAutoDuckingModal,
      setShowAutoDuckingModal: s.setShowAutoDuckingModal,
      showCustomFxMakerModal: s.showCustomFxMakerModal,
      closeCustomFxMaker: s.closeCustomFxMaker,
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
        <ErrorBoundary
          fallback={
            <div className="fixed inset-0 bg-black/75 z-[100] flex items-center justify-center p-4">
              <div className="bg-[#2d2d2d] rounded-xl p-6 max-w-sm border border-red-500/40 text-center space-y-4 shadow-2xl">
                <h3 className="text-white font-semibold text-sm">Export Window Error</h3>
                <p className="text-xs text-[#a0a0a0] leading-relaxed">
                  The export dialog encountered an issue. Your project changes are safely saved.
                </p>
                <button
                  onClick={() => useEditorStore.getState().setShowExportModal(false)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg font-medium transition-colors w-full"
                >
                  Close
                </button>
              </div>
            </div>
          }
          key="export-modal"
        >
          <ExportModal />
        </ErrorBoundary>
      )}
      {showSettingsModal && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
      {showAiSpeedSyncModal && (
        <Suspense fallback={null}>
          <AiSpeedSyncModal onClose={() => setShowAiSpeedSyncModal(false)} />
        </Suspense>
      )}
      {showAutoDuckingModal && (
        <Suspense fallback={null}>
          <AutoDuckingModal onClose={() => setShowAutoDuckingModal(false)} />
        </Suspense>
      )}
      {showCustomFxMakerModal && (
        <Suspense fallback={null}>
          <CustomFxMakerModal onClose={() => closeCustomFxMaker()} />
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
