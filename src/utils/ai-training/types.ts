export interface IntentAnalysis {
  intent: string;
  confidence: number;
  entities: Entity[];
  suggestedTools: string[];
}

export interface Entity {
  type: EntityType;
  value: any;
  raw: string;
  metadata?: any;
}

export type EntityType = 
  | 'TIME' 
  | 'DURATION' 
  | 'CLIP_REFERENCE' 
  | 'TRACK_REFERENCE' 
  | 'MEDIA_TYPE' 
  | 'EFFECT_TYPE' 
  | 'TRANSITION_TYPE' 
  | 'COLOR_VALUE' 
  | 'TRANSFORM_VALUE' 
  | 'POSITION' 
  | 'KEYFRAME_TYPE' 
  | 'FOLDER_REFERENCE' 
  | 'TEXT_CONTENT' 
  | 'AUDIO_PARAMETER' 
  | 'VIDEO_PARAMETER' 
  | 'EXPORT_SETTING'
  | 'SPEED_VALUE'
  | 'MASK_TYPE'
  | 'THUMBNAIL_PARAMETER'
  | 'TEMPLATE_REFERENCE';

export interface ThinkingTrace {
  analysis: string;
  plan: string;
  reasoning: string;
  confidence: number;
  alternativeApproaches?: string[];
  requiredContext?: string[];
}

export interface ToolValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
  missingContext?: string[];
  autoFix?: any;
}

export interface ConversationContext {
  selectedClipIds: string[];
  selectedTrackId?: string | null;
  currentTime: number;
  projectContext: {
    name: string;
    totalDuration: number;
    trackCount: number;
    clipCount: number;
    aspectRatio?: string;
    fps?: number;
  };
  recentActions: string[];
  userIntent?: string;
  clipboard?: { type: 'clip' | 'media' | 'effect'; data: any; };
  mediaLibrary?: any[]; // Phase 5: optional media library snapshot for matching
  failedStepSummary?: any[];
  lastFailure?: string;
}

export interface IntentPattern {
  pattern: RegExp;
  intent: string;
  baseConfidence: number;
  requiredEntities: EntityType[];
  suggestedTools: string[];
}

export interface AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[];
  generateAnalysis(intent: string, context: ConversationContext): string | null;
  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null;
  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null;
  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null;
}
