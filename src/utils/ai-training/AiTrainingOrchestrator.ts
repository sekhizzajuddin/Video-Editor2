import { Entity, EntityType, ConversationContext, IntentAnalysis, ThinkingTrace, AiTrainingModuleInterface, ToolValidationResult } from './types';
import { AiTrainingMediaImport } from './AiTrainingMediaImport';
import { AiTrainingMediaTransition } from './AiTrainingMediaTransition';
import { AiTrainingPropertyTransformation } from './AiTrainingPropertyTransformation';
import { AiTrainingPropertyColor } from './AiTrainingPropertyColor';
import { AiTrainingPlayback } from './AiTrainingPlayback';
import { AiTrainingAudio } from './AiTrainingAudio';
import { AiTrainingTextAndCaptions } from './AiTrainingTextAndCaptions';
import { AiTrainingTemplates } from './AiTrainingTemplates';
import { AiTrainingEffects } from './AiTrainingEffects';
import { AiTrainingPropertyMask } from './AiTrainingPropertyMask';
import { AiTrainingPropertySpeed } from './AiTrainingPropertySpeed';
import { AiTrainingHistory } from './AiTrainingHistory';
import { AiTrainingThumbnail } from './AiTrainingThumbnail';

export class AiTrainingOrchestrator {
  private feedbackHistory: Map<string, 'positive' | 'negative'> = new Map();
  private actionHistory: string[] = [];
  private modules: AiTrainingModuleInterface[] = [
    new AiTrainingMediaImport(),
    new AiTrainingMediaTransition(),
    new AiTrainingPropertyTransformation(),
    new AiTrainingPropertyColor(),
    new AiTrainingPlayback(),
    new AiTrainingAudio(),
    new AiTrainingTextAndCaptions(),
    new AiTrainingTemplates(),
    new AiTrainingEffects(),
    new AiTrainingPropertyMask(),
    new AiTrainingPropertySpeed(),
    new AiTrainingHistory(),
    new AiTrainingThumbnail(),
  ];

  async analyzeIntent(userMessage: string, context: ConversationContext): Promise<IntentAnalysis> {
    const lowerMessage = userMessage.toLowerCase();
    const entities = this.extractEntities(userMessage, context);

    let bestMatch: IntentAnalysis = {
      intent: 'GENERAL_QUERY',
      confidence: 0.5,
      entities,
      suggestedTools: [],
    };

    for (const module of this.modules) {
      const patterns = module.getIntentPatterns();
      for (const { pattern, intent, baseConfidence, requiredEntities, suggestedTools } of patterns) {
        if (pattern.test(userMessage)) {
          let confidence = baseConfidence;

          // Boost confidence if required entities are present
          const missingEntities = requiredEntities.filter(
            (entityType) => !entities.some((e) => e.type === entityType)
          );
          
          if (missingEntities.length === 0) {
            confidence = Math.min(0.95, confidence + 0.1);
          } else {
            confidence = Math.max(0.5, confidence - 0.05 * missingEntities.length);
          }

          // Context boosts
          if (
            ['UPDATE_CLIP', 'DELETE_CLIP', 'SPLIT_CLIP', 'ADD_KEYFRAME', 'MOVE_CLIP'].includes(intent) &&
            context.selectedClipIds.length > 0
          ) {
            confidence = Math.min(0.95, confidence + 0.1);
          }

          if (confidence > bestMatch.confidence) {
            bestMatch = { intent, confidence, entities, suggestedTools };
          }
        }
      }
    }

    return bestMatch;
  }

  async generateThinkingTrace(intent: string, context: ConversationContext, availableTools: any[]): Promise<ThinkingTrace> {
    let analysis = 'Analyzing user request and project context...';
    let plan = 'Executing standard procedure...';
    let reasoning = 'Formulating execution strategy based on analysis.';

    // Ask modules for traces
    for (const module of this.modules) {
      const modAnalysis = module.generateAnalysis(intent, context);
      if (modAnalysis) analysis = modAnalysis;

      const modPlan = module.generatePlan(intent, context, availableTools);
      if (modPlan) plan = modPlan;

      if (modAnalysis && modPlan) {
        const modReasoning = module.generateReasoning(intent, analysis, plan, context);
        if (modReasoning) reasoning = modReasoning;
      }
    }

    let confidence = this.calculateBaseConfidence(intent, context, availableTools);

    return {
      analysis,
      plan,
      reasoning,
      confidence
    };
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): { valid: boolean; error?: string; suggestion?: string } {
    for (const module of this.modules) {
      const validation = module.validateToolCall(toolName, args, context);
      if (validation !== null) {
        return validation;
      }
    }
    // Fallback: assume valid if no module handles it
    return { valid: true };
  }

  learnFromFeedback(messageId: string, feedback: 'positive' | 'negative'): void {
    this.feedbackHistory.set(messageId, feedback);
    
    if (feedback === 'positive') {
      this.actionHistory.push(`✓ Action at ${new Date().toISOString()}`);
    } else {
      this.actionHistory.push(`✗ Action at ${new Date().toISOString()}`);
    }

    if (this.feedbackHistory.size > 100) {
      const entries = Array.from(this.feedbackHistory.entries());
      const toDelete = entries.slice(0, entries.length - 50);
      toDelete.forEach(([key]) => this.feedbackHistory.delete(key));
    }
  }

  getRecentActions(): string[] {
    return this.actionHistory.slice(-10);
  }

  private calculateBaseConfidence(intent: string, context: ConversationContext, availableTools: any[]): number {
    let confidence = 0.75;
    
    // Context boosts confidence
    if (context.selectedClipIds.length > 0 && 
        ['UPDATE_CLIP', 'DELETE_CLIP', 'SPLIT_CLIP', 'ADD_KEYFRAME', 'MOVE_CLIP'].includes(intent)) {
      confidence += 0.1;
    }
    
    // Simple actions have higher confidence
    if (['PLAY', 'PAUSE', 'SEEK'].includes(intent)) {
      confidence += 0.1;
    }

    const recentNegativeFeedback = Array.from(this.feedbackHistory.values()).filter(f => f === 'negative').length;
    if (recentNegativeFeedback > 3) {
      confidence = Math.max(0.5, confidence - 0.1);
    }
    
    return Math.min(0.95, Math.max(0.5, confidence));
  }

  private extractEntities(message: string, context: ConversationContext): Entity[] {
    const entities: Entity[] = [];
    const lowerMessage = message.toLowerCase();

    // Time entities (e.g., "at 5 seconds")
    const timeMatch = lowerMessage.match(/(\d+\.?\d*)\s*(s|sec|seconds?|ms|milliseconds?)/i);
    if (timeMatch) {
      const value = parseFloat(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      const seconds = unit.startsWith('ms') ? value / 1000 : value;
      entities.push({ type: 'TIME', value: seconds, raw: timeMatch[0] });
    }

    // Clip references
    const clipIdMatch = lowerMessage.match(/(clip|video|audio|image|text)\s*[:\-]?\s*(\w+)/i);
    if (clipIdMatch) {
      entities.push({
        type: 'CLIP_REFERENCE',
        value: clipIdMatch[2],
        raw: clipIdMatch[0]
      });
    }

    // Position references
    const positionMatch = lowerMessage.match(/(start|begin|end|finish|middle|center)/i);
    if (positionMatch) {
      entities.push({
        type: 'POSITION',
        value: positionMatch[1].toLowerCase(),
        raw: positionMatch[0]
      });
    }

    return entities;
  }
}
