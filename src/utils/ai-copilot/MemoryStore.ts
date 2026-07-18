import type { ToolCall } from '../../hooks/useAiCopilot';

export interface RecordedAction {
  id: string;
  toolName: string;
  args: Record<string, any>;
  timestamp: number;
  rawPrompt: string;
  intent: string;
  resultStatus: 'success' | 'failed' | 'pending';
  messageId?: string;
  userFriendlyLabel?: string;
}

export interface ConversationMemoryEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  intent?: string;
}

const REFERENCE_KEYWORDS = [
  /^(do (that|this|it) again)$/i,
  /^(repeat (that|this|it))$/i,
  /^(again|same|redo that|do again)$/i,
  /\b(do that again|repeat that|same thing|do it again)\b/i,
  /^(do|run|try) (the )?last (thing|action|command|one)$/i,
  /^(again|same as before|as before)$/i,
];

const PRONOUN_RESOLUTION: Array<{ regex: RegExp; resolver: (lastAction: RecordedAction) => string }> = [
  {
    regex: /\b(do|apply|run) (it|that|this) (again|too)\b/i,
    resolver: (last) => `Execute the ${last.toolName} tool again with the same arguments`,
  },
  {
    regex: /\b(do|apply) (the same|that one) (to |on )?(it|that|this|selected clip|the last one)\b/i,
    resolver: (last) => `Apply ${last.toolName} to the same target`,
  },
];

const STORAGE_KEY_HISTORY = 'aicopilot_action_history';
const STORAGE_KEY_CONVERSATION = 'aicopilot_conversation_memory';
const MAX_HISTORY = 50;
const MAX_CONVERSATION = 100;

export class MemoryStore {
  private actionHistory: RecordedAction[] = [];
  private conversationMemory: ConversationMemoryEntry[] = [];
  private sessionId: string;
  private persistEnabled: boolean = false;

  constructor() {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (typeof window !== 'undefined') {
      try {
        this.persistEnabled = true;
        this.loadFromStorage();
      } catch (err) {
        console.warn('Failed to load AI memory from storage:', err);
        this.persistEnabled = false;
      }
    }
  }

  recordAction(action: Omit<RecordedAction, 'id' | 'timestamp'>): RecordedAction {
    const recorded: RecordedAction = {
      ...action,
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.actionHistory.push(recorded);

    if (this.actionHistory.length > MAX_HISTORY) {
      this.actionHistory = this.actionHistory.slice(-MAX_HISTORY);
    }

    this.saveToStorage();
    return recorded;
  }

  recordConversation(entry: Omit<ConversationMemoryEntry, 'id' | 'timestamp'>): ConversationMemoryEntry {
    const recorded: ConversationMemoryEntry = {
      ...entry,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    this.conversationMemory.push(recorded);

    if (this.conversationMemory.length > MAX_CONVERSATION) {
      this.conversationMemory = this.conversationMemory.slice(-MAX_CONVERSATION);
    }

    this.saveToStorage();
    return recorded;
  }

  getLastAction(): RecordedAction | null {
    if (this.actionHistory.length === 0) return null;
    return this.actionHistory[this.actionHistory.length - 1];
  }

  getRecentActions(count: number = 5): RecordedAction[] {
    return this.actionHistory.slice(-count);
  }

  getRecentConversations(count: number = 10): ConversationMemoryEntry[] {
    return this.conversationMemory.slice(-count);
  }

  isReferenceCommand(message: string): boolean {
    const trimmed = message.trim();
    return REFERENCE_KEYWORDS.some((regex) => regex.test(trimmed));
  }

  resolveReference(message: string): { resolved: string; originalAction?: RecordedAction; isReference: boolean } {
    const trimmed = message.trim();

    if (!this.isReferenceCommand(trimmed)) {
      return { resolved: message, isReference: false };
    }

    const lastAction = this.getLastAction();
    if (!lastAction) {
      return {
        resolved: message,
        isReference: true,
      };
    }

    for (const { regex, resolver } of PRONOUN_RESOLUTION) {
      const match = trimmed.match(regex);
      if (match) {
        return {
          resolved: `${resolver(lastAction)} (previously: ${lastAction.rawPrompt})`,
          originalAction: lastAction,
          isReference: true,
        };
      }
    }

    const reExecPrompt = `Re-execute the same action as before: ${lastAction.toolName} with ${
      lastAction.userFriendlyLabel || JSON.stringify(lastAction.args)
    }. This was the user's previous request: "${lastAction.rawPrompt}"`;

    return {
      resolved: reExecPrompt,
      originalAction: lastAction,
      isReference: true,
    };
  }

  clearHistory(): void {
    this.actionHistory = [];
    this.conversationMemory = [];
    this.saveToStorage();
  }

  getStats() {
    return {
      totalActions: this.actionHistory.length,
      totalConversations: this.conversationMemory.length,
      successCount: this.actionHistory.filter((a) => a.resultStatus === 'success').length,
      failedCount: this.actionHistory.filter((a) => a.resultStatus === 'failed').length,
      sessionId: this.sessionId,
    };
  }

  private saveToStorage(): void {
    if (!this.persistEnabled || typeof window === 'undefined') return;
    try {
      const historyData = JSON.stringify(this.actionHistory.slice(-MAX_HISTORY));
      const convData = JSON.stringify(this.conversationMemory.slice(-MAX_CONVERSATION));
      window.sessionStorage.setItem(STORAGE_KEY_HISTORY, historyData);
      window.sessionStorage.setItem(STORAGE_KEY_CONVERSATION, convData);
    } catch (err) {
      console.warn('Failed to save AI memory to storage:', err);
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const historyRaw = window.sessionStorage.getItem(STORAGE_KEY_HISTORY);
      const convRaw = window.sessionStorage.getItem(STORAGE_KEY_CONVERSATION);

      if (historyRaw) {
        const parsed = JSON.parse(historyRaw);
        if (Array.isArray(parsed)) this.actionHistory = parsed;
      }
      if (convRaw) {
        const parsed = JSON.parse(convRaw);
        if (Array.isArray(parsed)) this.conversationMemory = parsed;
      }
    } catch (err) {
      console.warn('Failed to parse stored AI memory:', err);
    }
  }
}

export const memoryStore = new MemoryStore();
