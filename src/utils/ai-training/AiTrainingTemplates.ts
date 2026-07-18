import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingTemplates implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(template|motion graphic|preset graphic)/i, 
        intent: 'ADD_TEMPLATE', 
        baseConfidence: 0.80, 
        requiredEntities: [], 
        suggestedTools: ['addClip'] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    return 'User wants to insert a pre-made motion graphic or text template.';
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    return '1. Lookup template by ID/name → 2. Create media item with template definition → 3. Add clip to timeline';
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    return `\`${analysis} Strategy: ${plan}\` Templates: Provide instant professional looks.`;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    return null;
  }
}
