import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingAudio implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(mute|silence|quiet)/i, 
        intent: 'MUTE_CLIP', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(volume|loud|soft|gain)/i, 
        intent: 'ADJUST_VOLUME', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(fade in|fade out|fade audio)/i, 
        intent: 'FADE_AUDIO', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(pitch|voice|sound like|formant|de-esser|compression|eq|bass|treble|mid)/i, 
        intent: 'ADJUST_AUDIO_FX', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(separate vocal|extract voice|remove background noise|denoise)/i, 
        intent: 'AI_SOUND_DESIGNER', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    if (['MUTE_CLIP', 'ADJUST_VOLUME', 'FADE_AUDIO', 'ADJUST_AUDIO_FX', 'AI_SOUND_DESIGNER'].includes(intent)) {
      return `User wants to adjust audio parameters. Will manipulate audio settings on target clip(s).`;
    }
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    return '1. Parse audio parameters → 2. Validate bounds (e.g. volume 0-1) → 3. Execute updateClip with audioSettings payload → 4. Refresh audio graph';
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    return `\`${analysis} Strategy: ${plan}\` Audio: Ensure smooth transitions to prevent popping.`;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    return null;
  }
}
