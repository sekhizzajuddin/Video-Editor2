import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingPlayback implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(play|start|resume|preview)/i, 
        intent: 'PLAY', 
        baseConfidence: 0.90, 
        requiredEntities: [], 
        suggestedTools: ['play'] 
      },
      { 
        pattern: /(pause|stop|halt|freeze)/i, 
        intent: 'PAUSE', 
        baseConfidence: 0.90, 
        requiredEntities: [], 
        suggestedTools: ['pause'] 
      },
      { 
        pattern: /(seek|jump|go to|move to|navigate)/i, 
        intent: 'SEEK', 
        baseConfidence: 0.85, 
        requiredEntities: ['TIME'], 
        suggestedTools: ['seek'] 
      },
      { 
        pattern: /(rewind|backward|reverse)/i, 
        intent: 'REWIND', 
        baseConfidence: 0.85, 
        requiredEntities: ['TIME'], 
        suggestedTools: ['seek'] 
      },
      { 
        pattern: /(forward|skip|advance)/i, 
        intent: 'FORWARD', 
        baseConfidence: 0.85, 
        requiredEntities: ['TIME'], 
        suggestedTools: ['seek'] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    const projectDur = context.projectContext.totalDuration;
    const currentTime = context.currentTime;
    
    if (intent === 'PLAY') return `User wants to preview. Current position: ${currentTime.toFixed(2)}s of ${projectDur.toFixed(1)}s total.`;
    if (intent === 'PAUSE') return `User wants to stop playback. Will preserve current time state at ${currentTime.toFixed(2)}s.`;
    if (intent === 'SEEK' || intent === 'REWIND' || intent === 'FORWARD') return `User wants to navigate. Need to validate target time is within timeline bounds (0-${projectDur.toFixed(1)}s).`;
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    if (intent === 'PLAY') return '1. Check if already playing (avoid duplicate) → 2. Execute play tool → 3. Monitor playback state → 4. Handle end-of-timeline';
    if (intent === 'PAUSE') return '1. Execute pause tool → 2. Preserve current time state → 3. Update UI controls';
    if (intent === 'SEEK' || intent === 'REWIND' || intent === 'FORWARD') return '1. Validate time within bounds (0 to duration) → 2. Execute seek → 3. Update playhead position → 4. Sync video element if playing';
    return null;
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    if (intent === 'PLAY') return `\`${analysis} Strategy: ${plan}\` Performance: Monitor frame rate and drop frames if needed.`;
    if (intent === 'PAUSE') return `\`${analysis} Strategy: ${plan}\` State: Preserve exact frame for resume.`;
    if (intent === 'SEEK' || intent === 'REWIND' || intent === 'FORWARD') return `\`${analysis} Strategy: ${plan}\` Accuracy: Snap to nearest frame boundary.`;
    return null;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    if (toolName === 'play' || toolName === 'pause') {
      return { valid: true };
    }
    if (toolName === 'seek') {
      if (args.time === undefined) return { valid: false, error: 'time is required' };
      if (args.time < 0) return { valid: false, error: 'time cannot be negative' };
      if (args.time > context.projectContext.totalDuration * 2) {
        return { 
          valid: false, 
          error: 'time exceeds reasonable timeline length', 
          suggestion: `Timeline is ${context.projectContext.totalDuration.toFixed(1)}s` 
        };
      }
      return { valid: true };
    }
    return null;
  }
}
