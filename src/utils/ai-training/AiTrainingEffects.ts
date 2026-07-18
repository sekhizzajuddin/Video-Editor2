import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingEffects implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(apply effect|add effect|vfx|visual effect|glitch|particles|chroma key|green screen)/i, 
        intent: 'APPLY_EFFECT', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(remove effect|delete effect|clear effect)/i, 
        intent: 'REMOVE_EFFECT', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(edit effect|tweak effect|change effect setting)/i, 
        intent: 'EDIT_EFFECT', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    if (intent === 'APPLY_EFFECT') return 'User wants to add a visual effect to a clip.';
    if (intent === 'REMOVE_EFFECT') return 'User wants to strip an effect from a clip.';
    if (intent === 'EDIT_EFFECT') return 'User wants to modify properties of an existing effect.';
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    return '1. Identify target clip → 2. Parse effect ID and parameters → 3. Execute updateClip with effect payload → 4. Render canvas';
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    return `\`${analysis} Strategy: ${plan}\` Effects: Validate that WebGL/canvas can support the requested shader/effect.`;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    return null;
  }
}
