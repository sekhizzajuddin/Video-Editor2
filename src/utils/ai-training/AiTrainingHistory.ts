import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingHistory implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(undo|revert|go back|mistake)/i, 
        intent: 'UNDO', 
        baseConfidence: 0.90, 
        requiredEntities: [], 
        suggestedTools: ['undo'] 
      },
      { 
        pattern: /(redo|reapply)/i, 
        intent: 'REDO', 
        baseConfidence: 0.90, 
        requiredEntities: [], 
        suggestedTools: ['redo'] 
      },
      { 
        pattern: /(history|show history|edit history)/i, 
        intent: 'SHOW_HISTORY', 
        baseConfidence: 0.85, 
        requiredEntities: [], 
        suggestedTools: [] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    if (intent === 'UNDO') return 'User wants to revert the last action.';
    if (intent === 'REDO') return 'User wants to re-apply the previously undone action.';
    if (intent === 'SHOW_HISTORY') return 'User wants to view the project edit history logs.';
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    if (intent === 'UNDO') return '1. Verify undo stack is not empty → 2. Execute undo tool → 3. Restore previous state';
    if (intent === 'REDO') return '1. Verify redo stack is not empty → 2. Execute redo tool → 3. Restore next state';
    return '1. Open properties panel → 2. Switch to History tab';
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    return `\`${analysis} Strategy: ${plan}\` State Management: Ensure atomic state transitions.`;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    return null;
  }
}
