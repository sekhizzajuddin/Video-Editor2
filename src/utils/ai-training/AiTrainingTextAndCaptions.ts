import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingTextAndCaptions implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(add text|insert text|create text|title)/i, 
        intent: 'ADD_TEXT', 
        baseConfidence: 0.85, 
        requiredEntities: [], 
        suggestedTools: ['addClip'] 
      },
      { 
        pattern: /(edit text|change text|update text|font|style text)/i, 
        intent: 'EDIT_TEXT', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(auto caption|transcribe|generate subtitle|subtitles)/i, 
        intent: 'AUTO_CAPTION', 
        baseConfidence: 0.90, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['autoCaption'] 
      },
      { 
        pattern: /(kinetic typography|animate text)/i, 
        intent: 'KINETIC_TYPOGRAPHY', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    if (intent === 'ADD_TEXT') return 'User wants to add a new text clip to the timeline.';
    if (intent === 'EDIT_TEXT') return 'User wants to modify text content or styling.';
    if (intent === 'AUTO_CAPTION') return 'User wants to generate subtitles from audio using AI transcription.';
    if (intent === 'KINETIC_TYPOGRAPHY') return 'User wants to apply motion presets to text.';
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    if (intent === 'ADD_TEXT') return '1. Create text media item → 2. Add clip to top track → 3. Open text properties';
    if (intent === 'EDIT_TEXT' || intent === 'KINETIC_TYPOGRAPHY') return '1. Parse text properties → 2. Execute updateClip with textSettings → 3. Re-render text overlay';
    if (intent === 'AUTO_CAPTION') return '1. Extract audio stream → 2. Send to transcription service → 3. Parse words/timestamps → 4. Generate subtitle clips/track';
    return null;
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    return `\`${analysis} Strategy: ${plan}\` Text: Maintain accessibility and readability.`;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    return null;
  }
}
