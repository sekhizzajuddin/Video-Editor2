import type { ConversationContext } from '../ai-training/types';

export type ComplexityLevel = 'local' | 'simple_ai' | 'workflow';

export type LocalIntent =
  | 'PLAY'
  | 'PAUSE'
  | 'STOP'
  | 'TOGGLE_PLAY'
  | 'SEEK'
  | 'UNDO'
  | 'REDO'
  | 'GET_DURATION'
  | 'GET_CLIP_COUNT'
  | 'GET_TRACK_COUNT'
  | 'GET_STATE'
  | 'GET_HELP'
  | 'MUTE_TRACK'
  | 'UNMUTE_TRACK'
  | 'RESET_ZOOM'
  | 'SAVE_PROJECT'
  | 'RUN_SELF_TEST'
  | 'CANCEL_OPERATION';

export interface LocalIntentMatch {
  intent: LocalIntent;
  confidence: number;
  args: Record<string, any>;
  rawMatch: string;
  requiresAi: false;
}

export interface PendingAiIntent {
  intent: 'AI_ASSIST';
  prompt: string;
  complexity: ComplexityLevel;
  requiresAi: true;
  estimatedSteps: number;
}

export type ParsedIntent = LocalIntentMatch | PendingAiIntent;

interface LocalPattern {
  intent: LocalIntent;
  patterns: RegExp[];
  extractor?: (match: RegExpMatchArray, text: string) => Record<string, any>;
  confidence?: number;
}

const LOCAL_PATTERNS: LocalPattern[] = [
  {
    intent: 'RUN_SELF_TEST',
    patterns: [
      /\b(test everything|run (a )?test|start testing|full test|self.?test|test all|run diagnostics|run (a )?diagnostic)\b/i,
    ],
    confidence: 0.95,
  },
  {
    intent: 'GET_HELP',
    patterns: [/\b(help|what can you do|commands|capabilities)\b/i],
    confidence: 0.9,
  },
  {
    intent: 'SAVE_PROJECT',
    patterns: [/\b(save (the )?project|save it|save(?!\s+(?:the\s+)?(?:clip|video|audio))\b)/i],
    confidence: 0.9,
  },
  {
    intent: 'UNDO',
    patterns: [/^(undo|reverse|revert that)$/i, /\bundo (the )?last\b/i],
    confidence: 0.95,
  },
  {
    intent: 'REDO',
    patterns: [/^(redo)$/i, /\bredo (that)?\b/i],
    confidence: 0.95,
  },
  {
    intent: 'PLAY',
    patterns: [/^(play|start|resume( playback)?)$/i, /\b(play|start|resume) (the )?(timeline|video|playback)\b/i],
    confidence: 0.9,
  },
  {
    intent: 'PAUSE',
    patterns: [/^(pause|hold|wait)$/i, /\bpause (the )?(timeline|video|playback)\b/i],
    confidence: 0.9,
  },
  {
    intent: 'STOP',
    patterns: [/^stop$/i, /\bstop (the )?(timeline|video|playback)\b/i],
    confidence: 0.85,
  },
  {
    intent: 'TOGGLE_PLAY',
    patterns: [/\b(toggle play|play.?pause|spacebar)\b/i],
    confidence: 0.95,
  },
  {
    intent: 'CANCEL_OPERATION',
    patterns: [/^(cancel|abort|stop)$/i, /\bcancel (that|this|the operation)\b/i],
    confidence: 0.85,
  },
  {
    intent: 'SEEK',
    patterns: [
      /\b(seek|jump|go|move) (to|at) (\d+\.?\d*) ?(s|sec|seconds?|ms|milliseconds?|minutes?|mins?|m|hours?|hrs?|h)?\b/i,
      /\bseek (to the )?(start|beginning|end|middle)\b/i,
    ],
    extractor: (match) => {
      const target = match[3]?.toLowerCase();
      const unit = match[4]?.toLowerCase();
      if (!target) return { position: match[5] || 'start' };

      if (['start', 'beginning'].includes(target)) return { position: 'start' };
      if (['end', 'finish'].includes(target)) return { position: 'end' };
      if (target === 'middle') return { position: 'middle' };

      let seconds = parseFloat(target);
      if (unit?.startsWith('m') && !unit.startsWith('ms')) seconds *= 60;
      else if (unit?.startsWith('h')) seconds *= 3600;
      return { time: seconds };
    },
    confidence: 0.95,
  },
  {
    intent: 'GET_DURATION',
    patterns: [
      /\b(what(?:'s| is) the (total )?duration|how long (is|of) (the )?(video|project|timeline))\b/i,
    ],
    confidence: 0.95,
  },
  {
    intent: 'GET_CLIP_COUNT',
    patterns: [/\bhow many clips?\b/i, /\b(count|number of) clips?\b/i],
    confidence: 0.9,
  },
  {
    intent: 'GET_TRACK_COUNT',
    patterns: [/\bhow many tracks?\b/i, /\b(count|number of) tracks?\b/i],
    confidence: 0.9,
  },
  {
    intent: 'GET_STATE',
    patterns: [/\b(editor (state|status)|current state|what'?s on the timeline)\b/i],
    confidence: 0.85,
  },
  {
    intent: 'MUTE_TRACK',
    patterns: [/\bmute (track|the (audio|video) track)\b/i],
    extractor: (match) => ({ trackRef: match[1] || 'all' }),
    confidence: 0.85,
  },
  {
    intent: 'UNMUTE_TRACK',
    patterns: [/\bunmute (track|the (audio|video) track)\b/i],
    extractor: (match) => ({ trackRef: match[1] || 'all' }),
    confidence: 0.85,
  },
];

const COMPLEX_KEYWORDS = /\b(then|after that|then add|also|next|and then|finally|sequence|chain|workflow|automate|pipeline)\b/i;

const STEP_INDICATORS = /\b(first|second|third|step \d+|\d+\.\s|[;,])\b/i;

const MULTI_VERB_PATTERN = /\b(import|load|add|create|delete|trim|split|apply|export|render|generate)[^.]*\b(then|after|and|also)[^.]*\b(import|load|add|create|delete|trim|split|apply|export|render|generate)\b/i;

export class NLUEngine {
  parse(message: string, context?: ConversationContext): ParsedIntent {
    const trimmed = message.trim();
    if (!trimmed) {
      return this.createAiIntent(message, 'simple_ai', 0);
    }

    const lower = trimmed.toLowerCase();

    for (const pattern of LOCAL_PATTERNS) {
      for (const regex of pattern.patterns) {
        const match = trimmed.match(regex);
        if (match) {
          const args = pattern.extractor
            ? pattern.extractor(match, trimmed)
            : {};
          return {
            intent: pattern.intent,
            confidence: pattern.confidence ?? 0.9,
            args,
            rawMatch: match[0],
            requiresAi: false,
          };
        }
      }
    }

    if (MULTI_VERB_PATTERN.test(lower) || STEP_INDICATORS.test(lower)) {
      const estimatedSteps = (lower.match(/[,;]/g)?.length || 0) + 1;
      return this.createAiIntent(message, 'workflow', Math.min(estimatedSteps, 10));
    }

    if (COMPLEX_KEYWORDS.test(lower)) {
      return this.createAiIntent(message, 'workflow', 2);
    }

    return this.createAiIntent(message, 'simple_ai', 1);
  }

  private createAiIntent(
    prompt: string,
    complexity: ComplexityLevel,
    estimatedSteps: number = 1
  ): PendingAiIntent {
    return {
      intent: 'AI_ASSIST',
      prompt,
      complexity,
      requiresAi: true,
      estimatedSteps,
    };
  }

  shouldRouteLocally(intent: ParsedIntent): intent is LocalIntentMatch {
    return !intent.requiresAi;
  }

  estimateComplexity(message: string): ComplexityLevel {
    const lower = message.toLowerCase();

    if (MULTI_VERB_PATTERN.test(lower)) return 'workflow';
    if (STEP_INDICATORS.test(lower)) return 'workflow';
    if (COMPLEX_KEYWORDS.test(lower)) return 'workflow';
    if (message.length > 200) return 'workflow';
    return 'simple_ai';
  }
}

export const nluEngine = new NLUEngine();

export const LOCAL_INTENT_HELPERS: Record<string, (intent: LocalIntentMatch, context: any) => string> = {
  RUN_SELF_TEST: () => 'Triggering self-test mode...',
  GET_HELP: () =>
    'I can help with:\n• Playback (play, pause, seek)\n• Editing (split, trim, delete clips)\n• Effects (LUT, color, transitions)\n• Text & captions\n• Export\n\nType "test everything" to run a full diagnostic.',
  GET_DURATION: (_, ctx) => {
    const dur = ctx?.projectContext?.totalDuration ?? 0;
    return `Total duration: ${dur.toFixed(2)}s (${Math.floor(dur / 60)}m ${Math.floor(dur % 60)}s)`;
  },
  GET_CLIP_COUNT: (_, ctx) => {
    const count = ctx?.projectContext?.clipCount ?? 0;
    return `${count} clip${count === 1 ? '' : 's'} on the timeline.`;
  },
  GET_TRACK_COUNT: (_, ctx) => {
    const count = ctx?.projectContext?.trackCount ?? 0;
    return `${count} track${count === 1 ? '' : 's'} in the project.`;
  },
};
