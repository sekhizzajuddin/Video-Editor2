import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingMediaTransition implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(delete|remove|cut|erase|clear).*clip/i, 
        intent: 'DELETE_CLIP', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['rippleDeleteClip', 'removeClip'] 
      },
      { 
        pattern: /(split|cut|divide|slice).*clip/i, 
        intent: 'SPLIT_CLIP', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE', 'TIME'], 
        suggestedTools: ['splitClip'] 
      },
      { 
        pattern: /(add|apply).*transition|crossfade|dissolve|fade/i, 
        intent: 'ADD_TRANSITION', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE', 'TRANSITION_TYPE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(move|drag|shift|reposition).*clip/i, 
        intent: 'MOVE_CLIP', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE', 'TIME'], 
        suggestedTools: ['moveClip'] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    const clipCount = context.selectedClipIds.length;
    const currentTime = context.currentTime;
    
    if (intent === 'DELETE_CLIP') {
      return `User wants to remove ${clipCount > 0 ? clipCount : 'a'} clip(s). This will affect timeline duration and may require ripple delete to close gaps.`;
    }
    if (intent === 'SPLIT_CLIP') {
      return `User wants to divide a clip. Playhead at ${currentTime.toFixed(2)}s. ${clipCount > 0 ? `${clipCount} clip(s) selected` : 'No clips selected - will target clip at playhead'}.`;
    }
    if (intent === 'ADD_TRANSITION') {
      return `User wants to apply a transition between clips or at clip boundaries.`;
    }
    if (intent === 'MOVE_CLIP') {
      return `User wants to reposition clip(s). Need to validate new position doesn't create overlaps or go out of bounds.`;
    }
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    if (intent === 'DELETE_CLIP') {
      return '1. Validate clip exists in timeline → 2. Check for dependencies (keyframes, effects) → 3. Execute rippleDeleteClip or removeClip → 4. Recalculate timeline duration → 5. Update UI selection';
    }
    if (intent === 'SPLIT_CLIP') {
      return '1. Validate split point within clip bounds → 2. Execute splitClip at playhead/time → 3. Preserve effects and keyframes on both segments → 4. Update UI selection to new clips';
    }
    if (intent === 'ADD_TRANSITION') {
      return '1. Validate clip exists → 2. Determine transition point (start or end) → 3. Execute updateClip with transition properties';
    }
    if (intent === 'MOVE_CLIP') {
      return '1. Validate target position within timeline → 2. Check for overlaps at destination → 3. Execute moveClip with overlap resolution → 4. Update snap lines and guides';
    }
    return null;
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    if (intent === 'DELETE_CLIP') return `\`${analysis} Strategy: ${plan}\` Caution: This action is destructive - ensure user intent is clear.`;
    if (intent === 'SPLIT_CLIP') return `\`${analysis} Strategy: ${plan}\` Note: Both resulting clips will inherit parent properties.`;
    if (intent === 'ADD_TRANSITION') return `\`${analysis} Strategy: ${plan}\` Note: Transition duration must not exceed clip limits.`;
    if (intent === 'MOVE_CLIP') return `\`${analysis} Strategy: ${plan}\` Constraint: Maintain clip within timeline bounds and avoid overlaps.`;
    return null;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    if (toolName === 'rippleDeleteClip' || toolName === 'removeClip') {
      if (!args.clipId) return { valid: false, error: 'clipId is required' };
      return { valid: true };
    }
    if (toolName === 'splitClip') {
      if (!args.clipId) return { valid: false, error: 'clipId is required' };
      if (args.splitTime !== undefined && args.splitTime < 0) {
        return { valid: false, error: 'splitTime cannot be negative', suggestion: 'Use playhead position or positive time' };
      }
      return { valid: true };
    }
    if (toolName === 'moveClip') {
      if (!args.clipId) return { valid: false, error: 'clipId is required' };
      if (args.targetTime < 0) return { valid: false, error: 'targetTime cannot be negative' };
      return { valid: true };
    }
    return null;
  }
}
