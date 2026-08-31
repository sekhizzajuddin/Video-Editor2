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
    <div className="bg-popover rounded border border-border">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between p-2.5 text-xs text-foreground"
      >
        <span className="font-medium">{title}</span>
        {collapsedSections[sectionKey] ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      {!collapsedSections[sectionKey] && (
        <div className="px-2.5 pb-3 space-y-3 border-t border-border/30 pt-2.5">
          {children}
        </div>
      )}
    </div>
  );
}