import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingPropertySpeed implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(speed up|slow down|change speed|fast forward|slow motion)/i, 
        intent: 'CHANGE_SPEED', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(speed ramp|time remapping)/i, 
        intent: 'SPEED_RAMP', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(freeze frame|pause video|still frame)/i, 
        intent: 'FREEZE_FRAME', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip', 'splitClip'] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    if (intent === 'CHANGE_SPEED') return 'User wants to change the playback rate of a clip.';
    if (intent === 'SPEED_RAMP') return 'User wants variable speed over time using keyframes.';
    if (intent === 'FREEZE_FRAME') return 'User wants to hold a specific frame for a duration.';
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    if (intent === 'CHANGE_SPEED') return '1. Calculate new duration based on speed multiplier → 2. Execute updateClip → 3. Ripple adjacent clips if needed';
    if (intent === 'FREEZE_FRAME') return '1. Split clip at playhead → 2. Create freeze frame clone → 3. Insert and ripple';
    return '1. Execute updateClip with speed mapping parameters';
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    return `\`${analysis} Strategy: ${plan}\` Speed: Preserve audio pitch if requested during time stretch.`;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    return null;
  }
}
