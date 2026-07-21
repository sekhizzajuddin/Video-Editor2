import React from 'react';

export const KeyframeIcon = ({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) => (
  <button
    onClick={onClick}
    className={`p-1 rounded transition-colors ${active ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20' : 'text-[#a0a0a0] hover:text-white hover:bg-[#3e3e3e]'}`}
    title={active ? "Disable Keyframes (Removes all)" : "Enable Keyframing"}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <polygon points="12 2 22 12 12 22 2 12 12 2" />
    </svg>
  </button>
);
