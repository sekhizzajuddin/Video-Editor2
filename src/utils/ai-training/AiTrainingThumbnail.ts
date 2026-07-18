import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingThumbnail implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(thumbnail|youtube thumbnail|cover image)/i, 
        intent: 'GENERATE_THUMBNAIL', 
        baseConfidence: 0.85, 
        requiredEntities: [], 
        suggestedTools: [] 
      },
      { 
        pattern: /(poster frame|set poster)/i, 
        intent: 'SET_POSTER_FRAME', 
        baseConfidence: 0.85, 
        requiredEntities: [], 
        suggestedTools: [] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    if (intent === 'GENERATE_THUMBNAIL') return 'User wants to generate a thumbnail from the current frame or AI generation.';
    if (intent === 'SET_POSTER_FRAME') return `User wants to set the video's poster frame to the current time (${context.currentTime}s).`;
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    return '1. Navigate to Thumbnail tab in Properties → 2. Extract current canvas frame → 3. Pass to thumbnail generation utility';
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    return `\`${analysis} Strategy: ${plan}\` Thumbnail: Capture at highest render resolution.`;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    return null;
  }
}
