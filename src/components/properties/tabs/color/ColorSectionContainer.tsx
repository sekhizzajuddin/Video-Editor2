import { ChevronDown, ChevronRight } from 'lucide-react';

interface ColorSectionContainerProps {
  title: string;
  sectionKey: string;
  collapsedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
  children: React.ReactNode;
}

export function ColorSectionContainer({ title, sectionKey, collapsedSections, toggleSection, children }: ColorSectionContainerProps) {
  return (
    <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] shadow-sm transition-all">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between p-3 text-xs text-[var(--theme-text-primary)] font-semibold"
      >
        <span>{title}</span>
        {collapsedSections[sectionKey] ? (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
        )}
      </button>
      {!collapsedSections[sectionKey] && (
        <div className="px-3 pb-3 space-y-3 border-t border-[var(--theme-border)] pt-3">
          {children}
        </div>
      )}
    </div>
  );
}