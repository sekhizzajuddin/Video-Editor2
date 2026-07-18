import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingMediaImport implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(add|create|insert|put|place).*clip/i, 
        intent: 'ADD_CLIP', 
        baseConfidence: 0.85, 
        requiredEntities: ['MEDIA_TYPE', 'TRACK_REFERENCE'], 
        suggestedTools: ['addClip'] 
      },
      { 
        pattern: /(duplicate|copy|clone).*clip/i, 
        intent: 'DUPLICATE_CLIP', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['addClip'] 
      },
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    if (intent === 'ADD_CLIP' || intent === 'DUPLICATE_CLIP') {
      return `User wants to add new content. Project "${context.projectContext.name}" has ${context.projectContext.clipCount} clips across ${context.projectContext.trackCount} tracks. Total duration: ${context.projectContext.totalDuration.toFixed(1)}s.`;
    }
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    if (intent === 'ADD_CLIP') {
      return '1. Identify media source from library → 2. Determine target track (prefer selected track or first available) → 3. Calculate optimal position (avoid overlaps) → 4. Execute addClip tool → 5. Save snapshot for undo';
    }
    if (intent === 'DUPLICATE_CLIP') {
      return '1. Validate source clip exists → 2. Extract mediaId and properties → 3. Find next available space on track → 4. Execute addClip tool';
    }
    return null;
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    if (intent === 'ADD_CLIP' || intent === 'DUPLICATE_CLIP') {
      return `\`${analysis} Strategy: ${plan}\` Priority: Ensure media exists and track is unlocked.`;
    }
    return null;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    if (toolName === 'addClip') {
      if (!args.mediaId) {
        return { valid: false, error: 'mediaId is required', suggestion: 'Select a media item from the library first' };
      }
      if (!args.trackId) {
        return { valid: false, error: 'trackId is required', suggestion: 'Specify which track to add the clip to (e.g., v1, a1)' };
      }
      if (args.startTime < 0) {
        return { valid: false, error: 'startTime cannot be negative', suggestion: 'Use 0 or a positive value' };
      }
      if (args.startTime > context.projectContext.totalDuration + 60) {
        return { 
          valid: false, 
          error: 'startTime is beyond reasonable timeline range', 
          suggestion: `Consider ${context.projectContext.totalDuration.toFixed(1)}s` 
        };
      }
      return { valid: true };
    }
    return null;
  }
}
