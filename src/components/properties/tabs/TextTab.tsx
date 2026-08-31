import type { TimelineClip } from '@/types';
import {
  TextContentSection,
  TextStylePresetsSection,
  FontFamilySection,
  FontSizeSection,
  TextColorSection,
  TextStyleButtonsSection,
  TextShadowSection,
} from './text';

interface TextTabProps {
  selectedClip: TimelineClip;
  updateClip: (clipId: string, updates: any) => void;
}

export function TextTab({ selectedClip, updateClip }: TextTabProps) {
  if (!selectedClip.textSettings) return null;

  const textSettings = selectedClip.textSettings;

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Text Properties</h3>
      </div>
      
      <div className="flex flex-col gap-4">
        <TextContentSection
          text={textSettings.text}
          onChange={(val) => updateClip(selectedClip.id, { textSettings: { ...textSettings, text: val } })}
        />

        <TextStylePresetsSection
          textSettings={textSettings}
          clipId={selectedClip.id}
          updateClip={updateClip}
        />

        <FontFamilySection
          fontFamily={textSettings.fontFamily || 'Arial'}
          onChange={(val) => updateClip(selectedClip.id, { textSettings: { ...textSettings, fontFamily: val } })}
        />

        <FontSizeSection
          fontSize={textSettings.fontSize || 48}
          onChange={(val) => updateClip(selectedClip.id, { textSettings: { ...textSettings, fontSize: val } })}
        />

        <TextColorSection
          color={textSettings.color || '#ffffff'}
          onChange={(val) => updateClip(selectedClip.id, { textSettings: { ...textSettings, color: val } })}
        />

        <TextStyleButtonsSection
          bold={textSettings.bold || false}
          italic={textSettings.italic || false}
          underline={textSettings.underline || false}
          onBoldToggle={() => updateClip(selectedClip.id, { textSettings: { ...textSettings, bold: !textSettings.bold } })}
          onItalicToggle={() => updateClip(selectedClip.id, { textSettings: { ...textSettings, italic: !textSettings.italic } })}
          onUnderlineToggle={() => updateClip(selectedClip.id, { textSettings: { ...textSettings, underline: !textSettings.underline } })}
        />

        <TextShadowSection
          shadow={textSettings.shadow || false}
          onToggle={() => updateClip(selectedClip.id, { textSettings: { ...textSettings, shadow: !textSettings.shadow } })}
        />
      </div>
    </div>
  );
}
