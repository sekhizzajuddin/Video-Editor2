import React, { useEffect, useState, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { HelpCircle } from 'lucide-react';

export const HelpTooltipManager: React.FC = () => {
  const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number } | null>(null);
  const { setShowHelpMenu, showHelpMenu } = useEditorStore(
    useShallow(s => ({
      setShowHelpMenu: s.setShowHelpMenu,
      showHelpMenu: s.showHelpMenu,
    }))
  );
  const hoveredHelpIdRef = useRef<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTooltipVisibleRef = useRef<boolean>(false);

  useEffect(() => {
    isTooltipVisibleRef.current = tooltipPos !== null;
  }, [tooltipPos]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Don't show tooltip if modal is already open
      if (useEditorStore.getState().showHelpMenu) {
        if (isTooltipVisibleRef.current) setTooltipPos(null);
        hoveredHelpIdRef.current = null;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        return;
      }

      const element = document.elementFromPoint(e.clientX, e.clientY);
      const helpTarget = element?.closest('[data-help-id]');
      const helpId = helpTarget?.getAttribute('data-help-id');

      if (helpId) {
        if (hoveredHelpIdRef.current !== helpId) {
          hoveredHelpIdRef.current = helpId;
          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          
          // Show tooltip after 800ms of hovering
          hoverTimeoutRef.current = setTimeout(() => {
            setTooltipPos({ x: e.clientX, y: e.clientY });
          }, 800);
        } else if (isTooltipVisibleRef.current) {
          // If tooltip is active, keep it near the mouse
          setTooltipPos({ x: e.clientX, y: e.clientY });
        }
      } else {
        if (hoveredHelpIdRef.current !== null) {
          hoveredHelpIdRef.current = null;
          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          if (isTooltipVisibleRef.current) setTooltipPos(null);
        }
      }
    };

    // Throttle mousemove for performance
    let rafId: number | null = null;
    const throttledMouseMove = (e: MouseEvent) => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          handleMouseMove(e);
          rafId = null;
        });
      }
    };

    window.addEventListener('mousemove', throttledMouseMove);
    return () => {
      window.removeEventListener('mousemove', throttledMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        const helpId = hoveredHelpIdRef.current;
        if (helpId) {
          setShowHelpMenu(true, helpId);
          setTooltipPos(null); // Hide tooltip when opening modal
        } else {
          // Open default if F1 pressed nowhere specific
          setShowHelpMenu(true, 'timeline');
          setTooltipPos(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowHelpMenu]);

  if (!tooltipPos) return null;

  return (
    <div 
      className="fixed z-[9000] pointer-events-none bg-surface-900 border border-surface-700 shadow-2xl px-3 py-1.5 rounded-lg flex items-center gap-2 animate-in fade-in duration-200"
      style={{ 
        left: Math.min(tooltipPos.x + 15, window.innerWidth - 150) + 'px', 
        top: Math.min(tooltipPos.y + 15, window.innerHeight - 50) + 'px' 
      }}
    >
      <HelpCircle className="w-4 h-4 text-amber-500" />
      <span className="text-xs text-white font-medium tracking-wide">Press F1 for Help</span>
    </div>
  );
};
